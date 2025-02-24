const Utils = require("../utils");
const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const DefaultMessageReceiverContract = artifacts.require("DefaultMessageReceiver");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

// This test does NOT include all getter methods, just
// getters that should work with only the constructor called
contract("Bridge - [admin]", async (accounts) => {
  const domainID = 1;
  const nonAdminAddress = accounts[1];

  const expectedBridgeAdmin = accounts[0];
  const authorizedAddress = accounts[2];
  const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const topologyHash = "549f715f5b06809ada23145c2dc548db";
  const txHash =
    "0x59d881e01ca682130e550e3576b6de760951fb45b1d5dd81342132f57920bbfa";
  const depositAmount = 10;
  const bytes32 = "0x0";
  const emptySetResourceData = "0x";

  let BridgeInstance;
  let ERC20MintableInstance;
  let ERC20HandlerInstance;
  let DefaultMessageReceiverInstance;
  let ResourceIDInstance;

  let withdrawData = "";

  const assertOnlyAdmin = (method) => {
    return Utils.expectToRevertWithCustomError(
      method(),
      "AccessNotAllowed(address,bytes4)"
    );
  };

  beforeEach(async () => {
    await Promise.all([
      BridgeInstance = await Utils.deployBridge(
        domainID,
        expectedBridgeAdmin
      ),
      ERC20MintableContract.new("token", "TOK").then(
        (instance) => (ERC20MintableInstance = instance)
      ),

    ]);

    DefaultMessageReceiverInstance = await DefaultMessageReceiverContract.new(
      [],
      100000
    );

    ERC20HandlerInstance = await ERC20HandlerContract.new(
      BridgeInstance.address,
      DefaultMessageReceiverInstance.address
    );

    ResourceIDInstance = Utils.createResourceID(
      ERC20MintableInstance.address,
      domainID
    );

    genericHandlerSetResourceData =
      Utils.constructGenericHandlerSetResourceData(
        Utils.blankFunctionSig,
        Utils.blankFunctionDepositorOffset,
        Utils.blankFunctionSig
      );
  });

  // Testing pauseable methods --------------------------------------------------------

  it("Bridge should not be paused after MPC address is set", async () => {
    await BridgeInstance.endKeygen(Utils.mpcAddress);
    assert.isFalse(await BridgeInstance.paused());
  });

  it("Bridge should be paused after being paused by admin", async () => {
    // set MPC address to unpause the Bridge
    await BridgeInstance.endKeygen(Utils.mpcAddress);

    await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
    assert.isTrue(await BridgeInstance.paused());
  });

  it("Bridge should be unpaused after being paused by admin", async () => {
    // set MPC address to unpause the Bridge
    await BridgeInstance.endKeygen(Utils.mpcAddress);

    await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
    assert.isTrue(await BridgeInstance.paused());
    await TruffleAssert.passes(BridgeInstance.adminUnpauseTransfers());
    assert.isFalse(await BridgeInstance.paused());
  });

  // Testing starKeygen, endKeygen and refreshKey methods ---------------------------------------

  it("Should successfully emit \"StartKeygen\" event if called by admin", async () => {
    const startKeygenTx = await BridgeInstance.startKeygen();
    TruffleAssert.eventEmitted(startKeygenTx, "StartKeygen");
  });

  it("Should fail if \"StartKeygen\" is called by non admin", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.startKeygen({ from: nonAdminAddress })
    );
  });

  it("Should fail if \"StartKeygen\" is called after MPC address is set", async () => {
    await BridgeInstance.endKeygen(Utils.mpcAddress);

    await Utils.expectToRevertWithCustomError(
      BridgeInstance.startKeygen(),
      "MPCAddressAlreadySet()"
    );
  });

  it("Should successfully set MPC address and emit \"EndKeygen\" event if called by admin", async () => {
    const startKeygenTx = await BridgeInstance.endKeygen(Utils.mpcAddress);

    assert.equal(await BridgeInstance._MPCAddress(), Utils.mpcAddress);

    TruffleAssert.eventEmitted(startKeygenTx, "EndKeygen");
  });

  it("Should fail if \"endKeygen\" is called by non admin", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.endKeygen(
        someAddress,
        { from: nonAdminAddress }
      )
    )
  });

  it("Should fail if null address is passed as MPC address", async () => {
    await Utils.expectToRevertWithCustomError(
      BridgeInstance.endKeygen(nullAddress),
      "MPCAddressZeroAddress()"
    );
  });

  it("Should fail if admin tries to update MPC address", async () => {
    await BridgeInstance.endKeygen(Utils.mpcAddress);

    await Utils.expectToRevertWithCustomError(
      BridgeInstance.endKeygen(someAddress),
      "MPCAddressIsNotUpdatable()"
    );
  });

  it("Should successfully emit \"KeyRefresh\" event with expected hash value if called by admin", async () => {
    const startKeygenTx = await BridgeInstance.refreshKey(topologyHash);

    TruffleAssert.eventEmitted(startKeygenTx, "KeyRefresh", (event) => {
      return (event.hash = topologyHash);
    });
  });

  it("Should fail if \"refreshKey\" is called by non admin", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.refreshKey(
        topologyHash,
        { from: nonAdminAddress }
      )
    )
  });

  // Set Handler Address ----------------------------------------

  it("Should set a Resource ID for handler address", async () => {
    assert.equal(
      await BridgeInstance._resourceIDToHandlerAddress.call(ResourceIDInstance),
      Ethers.constants.AddressZero
    );

    await TruffleAssert.passes(
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        ResourceIDInstance,
        ERC20MintableInstance.address,
        genericHandlerSetResourceData
      )
    );
    assert.equal(
      await BridgeInstance._resourceIDToHandlerAddress.call(ResourceIDInstance),
      ERC20HandlerInstance.address
    );
  });

  // Set resource ID --------------------------------------------------

  it("Should set a ERC20 Resource ID and contract address", async () => {

    await TruffleAssert.passes(
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        ResourceIDInstance,
        ERC20MintableInstance.address,
        genericHandlerSetResourceData
      )
    );
    assert.equal(
      await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(
        ResourceIDInstance
      ),
      ERC20MintableInstance.address
    );

    const retrievedResourceID = (await ERC20HandlerInstance._tokenContractAddressToTokenProperties.call(
      ERC20MintableInstance.address
    )).resourceID

    assert.equal(
      retrievedResourceID.toLowerCase(),
      ResourceIDInstance.toLowerCase()
    );
  });

  it("Should require admin role to set a ERC20 Resource ID and contract address", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.adminSetResource(
        someAddress,
        bytes32,
        someAddress,
        genericHandlerSetResourceData,
        { from: nonAdminAddress }
      )
    );
  });

  // Set burnable --------------------------------------------

  it("Should set ERC20MintableInstance.address as burnable", async () => {
    await TruffleAssert.passes(
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        ResourceIDInstance,
        ERC20MintableInstance.address,
        genericHandlerSetResourceData
      )
    );
    await TruffleAssert.passes(
      BridgeInstance.adminSetBurnable(
        ERC20HandlerInstance.address,
        ERC20MintableInstance.address
      )
    );
    const isBurnable = (await ERC20HandlerInstance._tokenContractAddressToTokenProperties.call(
      ERC20MintableInstance.address
    )).isBurnable;

    assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
  });

  it("Should require admin role to set ERC20MintableInstance.address as burnable", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.adminSetBurnable(
        someAddress,
        someAddress,
        { from: nonAdminAddress }
      )
    );
  });

  // Withdraw -------------------------------------------

  it("Should withdraw funds", async () => {
    const numTokens = 10;
    const tokenOwner = accounts[0];

    let ownerBalance;

    await TruffleAssert.passes(
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        ResourceIDInstance,
        ERC20MintableInstance.address,
        genericHandlerSetResourceData
      )
    );

    await ERC20MintableInstance.mint(tokenOwner, numTokens);
    ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
    assert.equal(ownerBalance, numTokens);

    await ERC20MintableInstance.transfer(
      ERC20HandlerInstance.address,
      numTokens
    );

    ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
    assert.equal(ownerBalance, 0);

    const handlerBalance = await ERC20MintableInstance.balanceOf(
      ERC20HandlerInstance.address
    );
    assert.equal(handlerBalance, numTokens);

    withdrawData = Utils.createERCWithdrawData(
      ERC20MintableInstance.address,
      tokenOwner,
      numTokens
    );

    await BridgeInstance.adminWithdraw(
      ERC20HandlerInstance.address,
      withdrawData
    );

    ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
    assert.equal(ownerBalance, numTokens);
  });

  it("Should require admin role to withdraw funds", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.adminWithdraw(
        someAddress,
        "0x0",
        { from: nonAdminAddress }
      )
    )
  });

  it("Should allow to withdraw funds if called by authorized address", async () => {
    const tokenOwner = accounts[0];

    expect(await ERC20HandlerInstance.hasRole(
      await ERC20HandlerInstance.LIQUIDITY_MANAGER_ROLE(),
      tokenOwner
    )).to.be.equal(false);

    await ERC20HandlerInstance.grantRole(
      await ERC20HandlerInstance.LIQUIDITY_MANAGER_ROLE(),
      authorizedAddress,
      {
        from: tokenOwner
      }
    );

    await ERC20MintableInstance.mint(ERC20HandlerInstance.address, depositAmount)
    const recipientBalanceBefore = await ERC20MintableInstance.balanceOf(tokenOwner);

    const withdrawData = Utils.createERCWithdrawData(
      ERC20MintableInstance.address,
      tokenOwner,
      depositAmount,
    );

    await TruffleAssert.passes(ERC20HandlerInstance.withdraw(withdrawData, { from: authorizedAddress }));
    const recipientBalanceAfter = await ERC20MintableInstance.balanceOf(tokenOwner);

    expect(
      new Ethers.BigNumber.from(depositAmount).add(recipientBalanceBefore.toString()).toString()
    ).to.be.equal(recipientBalanceAfter.toString());
  });

  // Set nonce -------------------------------------------------------------------------

  it("Should set nonce", async () => {
    const nonce = 3;
    await BridgeInstance.adminSetDepositNonce(domainID, nonce);
    const nonceAfterSet = await BridgeInstance._depositCounts.call(domainID);
    assert.equal(nonceAfterSet, nonce);
  });

  it("Should require admin role to set nonce", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.adminSetDepositNonce(
        1,
        3,
        { from: nonAdminAddress }
      )
    )
  });

  it("Should not allow for decrements of the nonce", async () => {
    const currentNonce = 3;
    await BridgeInstance.adminSetDepositNonce(domainID, currentNonce);
    const newNonce = 2;
    await Utils.reverts(
      BridgeInstance.adminSetDepositNonce(domainID, newNonce),
      "Does not allow decrements of the nonce"
    );
  });

  // Change access control contract
  it("Should require admin role to change access control contract", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.adminChangeAccessControl(
        someAddress,
        { from: nonAdminAddress }
      )
    )
  });

  // Retry

  it("Should require admin role to retry deposit", async () => {
    await assertOnlyAdmin(() =>
      BridgeInstance.retry(
        txHash,
        { from: nonAdminAddress }
      )
    )
  });

  it("Should successfully emit Retry event", async () => {
    const eventTx = await BridgeInstance.retry(txHash);

    TruffleAssert.eventEmitted(eventTx, "Retry", (event) => {
      return event.txHash === txHash;
    });
  });

});