// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../helpers");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const DefaultMessageReceiverContract = artifacts.require("DefaultMessageReceiver");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract("E2E ERC20 - Two EVM Chains", async (accounts) => {
  const adminAddress = accounts[0];

  const originDomainID = 1;
  const originRelayer1Address = accounts[3];

  const destinationDomainID = 2;
  const destinationRelayer1Address = accounts[3];

  const depositorAddress = accounts[1];
  const recipientAddress = accounts[2];
  const initialTokenAmount = 100;
  const depositAmount = 10;
  const expectedDepositNonce = 1;
  const feeData = "0x";
  const emptySetResourceData = "0x";

  let OriginBridgeInstance;
  let OriginERC20MintableInstance;
  let OriginDefaultMessageReceiverInstance;
  let OriginERC20HandlerInstance;
  let originDepositData;
  let originDepositProposalData;
  let originResourceID;
  let originBurnableContractAddresses;

  let DestinationBridgeInstance;
  let DestinationERC20MintableInstance;
  let DestinationDefaultMessageReceiverInstance;
  let DestinationERC20HandlerInstance;
  let destinationDepositData;
  let destinationDepositProposalData;
  let destinationResourceID;
  let destinationBurnableContractAddresses;

  let originDomainProposal;
  let destinationDomainProposal;

  beforeEach(async () => {
    await Promise.all([
      (OriginBridgeInstance = await Helpers.deployBridge(
        originDomainID,
        adminAddress
      )),
      (DestinationBridgeInstance = await Helpers.deployBridge(
        destinationDomainID,
        adminAddress
      )),
      ERC20MintableContract.new("token", "TOK").then(
        (instance) => (OriginERC20MintableInstance = instance)
      ),
      ERC20MintableContract.new("token", "TOK").then(
        (instance) => (DestinationERC20MintableInstance = instance)
      ),
    ]);

    originResourceID = Helpers.createResourceID(
      OriginERC20MintableInstance.address,
      originDomainID
    );
    originInitialResourceIDs = [originResourceID];
    originInitialContractAddresses = [OriginERC20MintableInstance.address];
    originBurnableContractAddresses = [OriginERC20MintableInstance.address];

    destinationResourceID = Helpers.createResourceID(
      DestinationERC20MintableInstance.address,
      originDomainID
    );
    destinationInitialResourceIDs = [destinationResourceID];
    destinationInitialContractAddresses = [
      DestinationERC20MintableInstance.address,
    ];
    destinationBurnableContractAddresses = [
      DestinationERC20MintableInstance.address,
    ];

    OriginDefaultMessageReceiverInstance = await DefaultMessageReceiverContract.new(
      [],
      100000
    );
    DestinationDefaultMessageReceiverInstance = await DefaultMessageReceiverContract.new(
      [],
      100000
    );
    await Promise.all([
      ERC20HandlerContract.new(
        OriginBridgeInstance.address,
        OriginDefaultMessageReceiverInstance.address
      ).then(
        (instance) => (OriginERC20HandlerInstance = instance)
      ),
      ERC20HandlerContract.new(
        DestinationBridgeInstance.address,
        DestinationDefaultMessageReceiverInstance.address
      ).then(
        (instance) => (DestinationERC20HandlerInstance = instance)
      ),
    ]);

    await OriginERC20MintableInstance.mint(
      depositorAddress,
      initialTokenAmount
    );

    await OriginERC20MintableInstance.approve(
      OriginERC20HandlerInstance.address,
      depositAmount,
      {from: depositorAddress}
    ),
    await OriginERC20MintableInstance.grantRole(
      await OriginERC20MintableInstance.MINTER_ROLE(),
      OriginERC20HandlerInstance.address
    ),
    await DestinationERC20MintableInstance.grantRole(
      await DestinationERC20MintableInstance.MINTER_ROLE(),
      DestinationERC20HandlerInstance.address
    ),
    await OriginBridgeInstance.adminSetResource(
      OriginERC20HandlerInstance.address,
      originResourceID,
      OriginERC20MintableInstance.address,
      emptySetResourceData
    ),
    await OriginBridgeInstance.adminSetBurnable(
      OriginERC20HandlerInstance.address,
      originBurnableContractAddresses[0]
    ),
    await DestinationBridgeInstance.adminSetResource(
      DestinationERC20HandlerInstance.address,
      destinationResourceID,
      DestinationERC20MintableInstance.address,
      emptySetResourceData
    ),
    await DestinationBridgeInstance.adminSetBurnable(
      DestinationERC20HandlerInstance.address,
      destinationBurnableContractAddresses[0]
    );

    originDepositData = Helpers.createERCDepositData(
      depositAmount,
      20,
      recipientAddress
    );
    originDepositProposalData = Helpers.createERCDepositData(
      depositAmount,
      20,
      recipientAddress
    );
    originDepositProposalDataHash = Ethers.utils.keccak256(
      DestinationERC20HandlerInstance.address +
        originDepositProposalData.substr(2)
    );

    destinationDepositData = Helpers.createERCDepositData(
      depositAmount,
      20,
      depositorAddress
    );
    destinationDepositProposalData = Helpers.createERCDepositData(
      depositAmount,
      20,
      depositorAddress
    );
    destinationDepositProposalDataHash = Ethers.utils.keccak256(
      OriginERC20HandlerInstance.address +
        destinationDepositProposalData.substr(2)
    );

    originDomainProposal = {
      originDomainID: originDomainID,
      depositNonce: expectedDepositNonce,
      data: originDepositProposalData,
      resourceID: destinationResourceID,
    };

    destinationDomainProposal = {
      originDomainID: destinationDomainID,
      depositNonce: expectedDepositNonce,
      data: destinationDepositProposalData,
      resourceID: originResourceID,
    };

      // set MPC address to unpause the Bridge
      await OriginBridgeInstance.endKeygen(Helpers.mpcAddress);
      await DestinationBridgeInstance.endKeygen(Helpers.mpcAddress);
  });

  it("[sanity] depositorAddress' balance should be equal to initialTokenAmount", async () => {
    const depositorBalance = await OriginERC20MintableInstance.balanceOf(
      depositorAddress
    );
    assert.strictEqual(depositorBalance.toNumber(), initialTokenAmount);
  });

  it(
    "[sanity] OriginERC20HandlerInstance.address should have an allowance of depositAmount from depositorAddress",
    async () => {
    const handlerAllowance = await OriginERC20MintableInstance.allowance(
      depositorAddress,
      OriginERC20HandlerInstance.address
    );
    assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
  });

  it(
    "[sanity] DestinationERC20HandlerInstance.address  should have minterRole for DestinationERC20MintableInstance",
    async () => {
    const isMinter = await DestinationERC20MintableInstance.hasRole(
      await DestinationERC20MintableInstance.MINTER_ROLE(),
      DestinationERC20HandlerInstance.address
    );
    assert.isTrue(isMinter);
  });

  it(`E2E: depositAmount of Origin ERC20 owned by depositAddress to Destination ERC20
      owned by recipientAddress and back again`, async () => {
    const originProposalSignedData = await Helpers.signTypedProposal(
      DestinationBridgeInstance.address,
      [originDomainProposal]
    );
    const destinationProposalSignedData = await Helpers.signTypedProposal(
      OriginBridgeInstance.address,
      [destinationDomainProposal]
    );

    let depositorBalance;
    let recipientBalance;

    // depositorAddress makes initial deposit of depositAmount
    await TruffleAssert.passes(
      OriginBridgeInstance.deposit(
        destinationDomainID,
        originResourceID,
        originDepositData,
        feeData,
        {from: depositorAddress}
      )
    );

    // destinationRelayer1 executes the proposal
    await TruffleAssert.passes(
      DestinationBridgeInstance.executeProposal(
        originDomainProposal,
        originProposalSignedData,
        {from: destinationRelayer1Address}
      )
    );

    // Assert ERC20 balance was transferred from depositorAddress
    depositorBalance = await OriginERC20MintableInstance.balanceOf(
      depositorAddress
    );
    assert.strictEqual(
      depositorBalance.toNumber(),
      initialTokenAmount - depositAmount,
      "depositAmount wasn't transferred from depositorAddress"
    );

    // Assert ERC20 balance was transferred to recipientAddress
    recipientBalance = await DestinationERC20MintableInstance.balanceOf(
      recipientAddress
    );
    assert.strictEqual(
      recipientBalance.toNumber(),
      depositAmount,
      "depositAmount wasn't transferred to recipientAddress"
    );

    // At this point a representation of OriginERC20Mintable has been transferred from
    // depositor to the recipient using Both Bridges and DestinationERC20Mintable.
    // Next we will transfer DestinationERC20Mintable back to the depositor

    await DestinationERC20MintableInstance.approve(
      DestinationERC20HandlerInstance.address,
      depositAmount,
      {from: recipientAddress}
    );

    // recipientAddress makes a deposit of the received depositAmount
    await TruffleAssert.passes(
      DestinationBridgeInstance.deposit(
        originDomainID,
        destinationResourceID,
        destinationDepositData,
        feeData,
        {from: recipientAddress}
      )
    );

    // Recipient should have a balance of 0 (deposit amount - deposit amount)
    recipientBalance = await DestinationERC20MintableInstance.balanceOf(
      recipientAddress
    );
    assert.strictEqual(recipientBalance.toNumber(), 0);

    // destinationRelayer1 executes the proposal
    await TruffleAssert.passes(
      OriginBridgeInstance.executeProposal(
        destinationDomainProposal,
        destinationProposalSignedData,
        {from: originRelayer1Address}
      )
    );

    // Assert ERC20 balance was transferred from recipientAddress
    recipientBalance = await DestinationERC20MintableInstance.balanceOf(
      recipientAddress
    );
    assert.strictEqual(recipientBalance.toNumber(), 0);

    // Assert ERC20 balance was transferred to recipientAddress
    depositorBalance = await OriginERC20MintableInstance.balanceOf(
      depositorAddress
    );
    assert.strictEqual(depositorBalance.toNumber(), initialTokenAmount);
  });
});