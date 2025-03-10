const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");
const Utils = require("../utils");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const DefaultMessageReceiverContract = artifacts.require("DefaultMessageReceiver");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract("Bridge - [execute proposal - ERC20]", async (accounts) => {
    const chainId = 1;
    const InvalidChainId = 2;
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
    let depositProposalDataHash;

    let data = "";
    let dataHash = "";
    let proposal;

    beforeEach(async () => {
        await Promise.all([
            (BridgeInstance = await Utils.deployBridge(
                destinationDomainID,
                adminAddress
            )),
            ERC20MintableContract.new("token", "TOK").then(
                (instance) => (ERC20MintableInstance = instance)
            ),
        ]);

        resourceID = Utils.createResourceID(
            ERC20MintableInstance.address,
            destinationDomainID
        );

        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];
        burnableContractAddresses = [];

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

        data = Utils.createERCDepositData(depositAmount, 20, recipientAddress);
        dataHash = Ethers.utils.keccak256(
            ERC20HandlerInstance.address + data.substring(2)
        );

        await ERC20MintableInstance.approve(
            ERC20HandlerInstance.address,
            depositAmount,
            { from: depositorAddress }
        );

        depositData = Utils.createERCDepositData(
            depositAmount,
            20,
            recipientAddress
        );
        depositProposalData = Utils.createERCDepositData(
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
            resourceID: resourceID,
            data: depositProposalData,
        };

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Utils.mpcAddress);
    });

    it("isProposalExecuted returns false if depositNonce is not used", async () => {
        const destinationDomainID = await BridgeInstance._domainID();

        assert.isFalse(
            await BridgeInstance.isProposalExecuted(
                destinationDomainID,
                expectedDepositNonce
            )
        );
    });

    it("should create and execute executeProposal successfully", async () => {
        const proposalSignedData = Utils.signTypedProposal(
            BridgeInstance.address,
            [proposal],
            chainId

        );

        // depositorAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(
            BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, {
                from: depositorAddress,
            })
        );

        await Utils.passes(
            BridgeInstance.executeProposal(proposal, proposalSignedData, {
                from: relayer1Address,
            })
        );

        // check that deposit nonce has been marked as used in bitmap
        assert.isTrue(
            await BridgeInstance.isProposalExecuted(
                originDomainID,
                expectedDepositNonce
            )
        );

        // check that tokens are transferred to recipient address
        const recipientBalance = await ERC20MintableInstance.balanceOf(
            recipientAddress
        );
        assert.strictEqual(recipientBalance.toNumber(), depositAmount);
    });

    it("should skip executing proposal if deposit nonce is already used", async () => {
        const proposalSignedData = Utils.signTypedProposal(
            BridgeInstance.address,
            [proposal],
            chainId
        );

        // depositorAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(
            BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, {
                from: depositorAddress,
            })
        );

        await TruffleAssert.passes(
            BridgeInstance.executeProposal(proposal, proposalSignedData, {
                from: relayer1Address,
            })
        );

        const skipExecuteTx = await BridgeInstance.executeProposal(
            proposal,
            proposalSignedData,
            { from: relayer1Address }
        );

        // check that no ProposalExecution events are emitted
        assert.equal(skipExecuteTx.logs.length, 0);
    });

    it("executeProposal event should be emitted with expected values", async () => {
        const proposalSignedData = Utils.signTypedProposal(
            BridgeInstance.address,
            [proposal],
            chainId
        );

        // depositorAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(
            BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, {
                from: depositorAddress,
            })
        );

        const proposalTx = await BridgeInstance.executeProposal(
            proposal,
            proposalSignedData,
            { from: relayer1Address }
        );

        TruffleAssert.eventEmitted(proposalTx, "ProposalExecution", (event) => {
            return (
                event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.dataHash === dataHash &&
                event.handlerResponse === Ethers.utils.defaultAbiCoder.encode(
                    ["address", "address", "uint256"],
                    [ERC20MintableInstance.address, recipientAddress, depositAmount]
                )
            );
        });

        // check that deposit nonce has been marked as used in bitmap
        assert.isTrue(
            await BridgeInstance.isProposalExecuted(
                originDomainID,
                expectedDepositNonce
            )
        );

        // check that tokens are transferred to recipient address
        const recipientBalance = await ERC20MintableInstance.balanceOf(
            recipientAddress
        );
        assert.strictEqual(recipientBalance.toNumber(), depositAmount);
    });


    it(`should fail to executeProposal if signed Proposal has different chainID than the one on which it should be executed`, async () => {
        const proposalSignedData =
            Utils.signTypedProposal(
                BridgeInstance.address,
                [proposal],
                InvalidChainId
            );

        // depositorAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(
            BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, {
                from: depositorAddress,
            })
        );

        await Utils.expectToRevertWithCustomError(
            BridgeInstance.executeProposal(proposal, proposalSignedData, {
                from: relayer1Address,
            }),
            "InvalidProposalSigner()"
        );
    });
});