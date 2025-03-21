// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../helpers");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const DefaultMessageReceiverContract = artifacts.require("DefaultMessageReceiver");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract("E2E ERC20 - Same Chain", async (accounts) => {
  const originDomainID = 1;
  const destinationDomainID = 2;

  const adminAddress = accounts[0];
  const depositorAddress = accounts[1];
  const recipientAddress = accounts[2];
  const relayer1Address = accounts[3];

  const initialTokenAmount = 100;
  const depositAmount = 10;
  const expectedDepositNonce = 1;
  const feeData = "0x";
  const emptySetResourceData = "0x";

  let BridgeInstance;
  let ERC20MintableInstance;
  let ERC20HandlerInstance;
  let DefaultMessageReceiverInstance;

  let resourceID;
  let depositData;
  let depositProposalData;

  let proposal;

  beforeEach(async () => {
    await Promise.all([
      (BridgeInstance = await Helpers.deployBridge(
        destinationDomainID,
        adminAddress
      )),
      ERC20MintableContract.new("token", "TOK").then(
        (instance) => (ERC20MintableInstance = instance)
      ),
    ]);

    resourceID = Helpers.createResourceID(
      ERC20MintableInstance.address,
      originDomainID
    );

    DefaultMessageReceiverInstance = await DefaultMessageReceiverContract.new(
      [],
      100000
    );
    ERC20HandlerInstance = await ERC20HandlerContract.new(
      BridgeInstance.address,
      DefaultMessageReceiverInstance.address
    );

    await Promise.all([
      ERC20MintableInstance.mint(depositorAddress, initialTokenAmount),
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        resourceID,
        ERC20MintableInstance.address,
        emptySetResourceData
      ),
    ]);

    await ERC20MintableInstance.approve(
      ERC20HandlerInstance.address,
      depositAmount,
      {from: depositorAddress}
    );

    depositData = Helpers.createERCDepositData(
      depositAmount,
      20,
      recipientAddress
    );
    depositProposalData = Helpers.createERCDepositData(
      depositAmount,
      20,
      recipientAddress
    );
    depositProposalDataHash = Ethers.utils.keccak256(
      ERC20HandlerInstance.address + depositProposalData.substr(2)
    );

    proposal = {
      originDomainID: originDomainID,
      depositNonce: expectedDepositNonce,
      data: depositProposalData,
      resourceID: resourceID,
    };

    // set MPC address to unpause the Bridge
    await BridgeInstance.endKeygen(Helpers.mpcAddress);
  });

  it("[sanity] depositorAddress' balance should be equal to initialTokenAmount", async () => {
    const depositorBalance = await ERC20MintableInstance.balanceOf(
      depositorAddress
    );
    assert.strictEqual(depositorBalance.toNumber(), initialTokenAmount);
  });

  it(
    "[sanity] ERC20HandlerInstance.address should have an allowance of depositAmount from depositorAddress",
    async () => {
    const handlerAllowance = await ERC20MintableInstance.allowance(
      depositorAddress,
      ERC20HandlerInstance.address
    );
    assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
  });

  it("depositAmount of Destination ERC20 should be transferred to recipientAddress", async () => {
    const proposalSignedData = await Helpers.signTypedProposal(
      BridgeInstance.address,
      [proposal]
    );

    // depositorAddress makes initial deposit of depositAmount
    assert.isFalse(await BridgeInstance.paused());
    await TruffleAssert.passes(
      BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, {
        from: depositorAddress,
      })
    );

    // Handler should have a balance of depositAmount
    const handlerBalance = await ERC20MintableInstance.balanceOf(
      ERC20HandlerInstance.address
    );
    assert.strictEqual(handlerBalance.toNumber(), depositAmount);

    // relayer2 executes the proposal
    await TruffleAssert.passes(
      BridgeInstance.executeProposal(proposal, proposalSignedData, {
        from: relayer1Address,
      })
    );

    // Assert ERC20 balance was transferred from depositorAddress
    const depositorBalance = await ERC20MintableInstance.balanceOf(
      depositorAddress
    );
    assert.strictEqual(
      depositorBalance.toNumber(),
      initialTokenAmount - depositAmount
    );

    // // Assert ERC20 balance was transferred to recipientAddress
    const recipientBalance = await ERC20MintableInstance.balanceOf(
      recipientAddress
    );
    assert.strictEqual(recipientBalance.toNumber(), depositAmount);
  });
});