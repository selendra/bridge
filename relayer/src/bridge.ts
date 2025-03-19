import { ethers } from "ethers";
import dotenv from 'dotenv';
import { AccessControlSegregatorContractJson, BridgeContractJson, DefaultMessageReceiverContractJson, Erc20ContractJson, Erc20HandlerContractJson } from "./constantd";
import { accessControlFuncSignatures, signTypedProposal, toHex } from "./utils";
import { BridgeProposal, IContractInstances } from "./interface";

dotenv.config();

export class Bridge {
    private contractInstances: IContractInstances = {};
    private readonly wallet: ethers.Wallet;
    private readonly provider: ethers.providers.JsonRpcProvider;
    private readonly domainId: number;

    constructor(domainId: number) {
        const providerUrl = process.env.PROVIDER_URL;
        if (!providerUrl) {
            throw new Error("Provider URL is not defined in environment variables");
        }

        const privateKey = process.env.PRIVATE_KEY || "";
        if (!privateKey) {
            throw new Error("WARNING: No private key found in environment variables");
        }

        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.domainId = domainId;
    }

    get bridgeContract(): ethers.Contract | undefined {
        return this.contractInstances.bridge;
    }

    get erc20Contract(): ethers.Contract | undefined {
        return this.contractInstances.erc20;
    }

    get erc20HandlerContract(): ethers.Contract | undefined {
        return this.contractInstances.erc20Handler;
    }

    get getChainId(): Promise<number> {
        return this.provider.getNetwork().then(n => n.chainId)
    }

    getBridgeContract(address: string): void {
        if (!ethers.utils.isAddress(address)) {
            throw new Error(`Invalid contract address: ${address}`);
        }
        this.contractInstances.bridge = new ethers.Contract(address, BridgeContractJson.abi, this.wallet);
    }

    getErc20Contract(address: string): void {
        if (!ethers.utils.isAddress(address)) {
            throw new Error(`Invalid contract address: ${address}`);
        }
        this.contractInstances.erc20 = new ethers.Contract(address, Erc20ContractJson.abi, this.wallet);
    }

    getEr20HandlerContract(address: string): void {
        if (!ethers.utils.isAddress(address)) {
            throw new Error(`Invalid contract address: ${address}`);
        }
        this.contractInstances.erc20Handler = new ethers.Contract(address, Erc20HandlerContractJson.abi, this.wallet);
    }

    async deployAccessControlContract(adminAddress: string): Promise<void> {
        if (!adminAddress) {
            throw new Error("Admin address is required");
        }

        const accessControlSegregatorContract = new ethers.ContractFactory(
            AccessControlSegregatorContractJson.abi,
            AccessControlSegregatorContractJson.bytecode,
            this.wallet
        );

        try {
            const accessControlInstance = await accessControlSegregatorContract.deploy(
                accessControlFuncSignatures,
                Array(13).fill(adminAddress)
            );
            await accessControlInstance.deployed();

            this.contractInstances.accessControl = accessControlInstance;
        } catch (error) {
            throw new Error(`Failed to deploy Access Control contract: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deployBridgeContract(): Promise<void> {
        if (!this.contractInstances.accessControl) {
            throw new Error("Access control contract not deployed. Call deployAccessControlContract first.");
        }

        const bridgeContract = new ethers.ContractFactory(
            BridgeContractJson.abi,
            BridgeContractJson.bytecode,
            this.wallet
        );

        try {
            const bridgeInstance = await bridgeContract.deploy(
                this.domainId,
                this.contractInstances.accessControl.address
            );
            await bridgeInstance.deployed();

            this.contractInstances.bridge = bridgeInstance;
        } catch (error) {
            throw new Error(`Failed to deploy Bridge contract: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deployErc20Contract(name: string, symbol: string): Promise<void> {
        const erc20Contract = new ethers.ContractFactory(
            Erc20ContractJson.abi,
            Erc20ContractJson.bytecode,
            this.wallet
        );
        try {
            const erc20Instance = await erc20Contract.deploy(name, symbol);
            await erc20Instance.deployed();

            this.contractInstances.erc20 = erc20Instance;
        } catch (error) {
            throw new Error(`Failed to deploy erc20 contract: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async defaultMessageReceiver() {
        const defaultMessageReceiverContract = new ethers.ContractFactory(
            DefaultMessageReceiverContractJson.abi,
            DefaultMessageReceiverContractJson.bytecode,
            this.wallet
        );

        try {
            const defaultMessageReceiverInstance = await defaultMessageReceiverContract.deploy(
                [],
                100000
            );
            await defaultMessageReceiverInstance.deployed();

            this.contractInstances.defaultMessageReceiver = defaultMessageReceiverInstance;
        } catch (error) {
            throw new Error(`Failed to deploy default message receiver contract: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deployErc20Handler(): Promise<void> {
        if (
            !this.contractInstances.defaultMessageReceiver ||
            !this.contractInstances.bridge
        ) {
            throw new Error("Required contracts not deployed. Ensure all contracts are deployed before setting resources.");
        }

        const erc20HandlerContract = new ethers.ContractFactory(
            Erc20HandlerContractJson.abi,
            Erc20HandlerContractJson.bytecode,
            this.wallet
        );

        try {
            const erc20HandlerInstance = await erc20HandlerContract.deploy(
                this.contractInstances.bridge.address,
                this.contractInstances.defaultMessageReceiver.address
            );

            await erc20HandlerInstance.deployed();

            this.contractInstances.erc20Handler = erc20HandlerInstance;
        } catch (error) {
            throw new Error(`Failed to deploy ERC20 Handler contract: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async bridgeSetResource(): Promise<void> {
        if (
            !this.contractInstances.defaultMessageReceiver ||
            !this.contractInstances.erc20Handler ||
            !this.contractInstances.bridge ||
            !this.contractInstances.erc20
        ) {
            throw new Error("Required contracts not deployed. Ensure all contracts are deployed before setting resources.");
        }

        try {
            const resourceID = this.createResourceId(this.contractInstances.erc20.address);
            const decimals = await this.contractInstances.erc20.decimals();

            const tx = await this.contractInstances.bridge.adminSetResource(
                this.contractInstances.erc20Handler.address,
                resourceID,
                this.contractInstances.erc20.address,
                ethers.utils.hexlify(Number(decimals))
            );

            const receipt = await tx.wait();
            console.log(`Resource set successfully at ${new Date().toISOString()}. Transaction hash: ${receipt.transactionHash}`);
        } catch (error) {
            throw new Error(`Failed to set resource on bridge: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async erc20GrantMinterBurnnerRole(): Promise<void> {
        if (
            !this.contractInstances.erc20Handler ||
            !this.contractInstances.bridge ||
            !this.contractInstances.erc20
        ) {
            throw new Error("Required contracts not deployed. Ensure all contracts are deployed before setting resources.");
        }

        try {
            const MINTER_ROLE = await this.contractInstances.erc20.MINTER_ROLE();

            console.log(`Granting MINTER_ROLE to ERC20 handler at ${this.contractInstances.erc20Handler.address}...`);
            const grantRoleTx = await this.contractInstances.erc20.grantRole(
                MINTER_ROLE,
                this.contractInstances.erc20Handler.address
            );
            const grantRoleReceipt = await grantRoleTx.wait();
            console.log(`MINTER_ROLE granted successfully. Transaction hash: ${grantRoleReceipt.transactionHash}`);

            console.log(`Setting ${this.contractInstances.erc20.address} as burnable in bridge...`);
            const setBurnableTx = await this.contractInstances.bridge.adminSetBurnable(
                this.contractInstances.erc20Handler.address,
                this.contractInstances.erc20.address
            );

            const setBurnableReceipt = await setBurnableTx.wait();
            console.log(`Token set as burnable successfully. Transaction hash: ${setBurnableReceipt.transactionHash}`);
        } catch (error) {
            throw new Error(`Failed to grant MINTER_ROLE or set as burnable: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async ec20MintToken(receiverAddress: string, amount: number): Promise<void> {
        if (!this.contractInstances.erc20) {
            throw new Error("ERC20 contract not deployed. Deploy ERC20 contract first.");
        }

        if (!ethers.utils.isAddress(receiverAddress)) {
            throw new Error(`Invalid receiver address: ${receiverAddress}`);
        }

        if (amount <= 0) {
            throw new Error("Amount must be greater than zero");
        }

        try {
            const decimals = await this.contractInstances.erc20.decimals();
            const tokenAmount = ethers.utils.parseUnits(amount.toString(), decimals);

            console.log(`Minting ${amount} tokens to ${receiverAddress}...`);

            const mintTx = await this.contractInstances.erc20.mint(
                receiverAddress,
                tokenAmount
            );

            const receipt = await mintTx.wait();

            console.log(`Tokens minted successfully. Transaction hash: ${receipt.transactionHash}`);
        } catch (error) {
            throw new Error(`Failed to mint tokens: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async messageReceiveGrantRole(): Promise<void> {
        if (!this.contractInstances.defaultMessageReceiver) {
            throw new Error("MessageReceiver contract not deployed.");
        }

        if (!this.contractInstances.erc20Handler) {
            throw new Error("Erc20Handler contract not deployed.");
        }
        this.contractInstances.defaultMessageReceiver.grantRole(
            await this.contractInstances.defaultMessageReceiver.SYGMA_HANDLER_ROLE(),
            this.contractInstances.erc20Handler.address
        );
    }

    async isBridgePaused(): Promise<boolean> {
        if (!this.contractInstances.bridge) {
            throw new Error("Bridge contract not deployed. Call deployBridgeContract first.");
        }

        try {
            const isPaused = await this.contractInstances.bridge.paused();
            console.log(`Bridge is ${isPaused ? 'paused' : 'not paused'}`);

            return isPaused;
        } catch (error) {
            console.error(`Error checking bridge pause state: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to check if bridge is paused: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async mpcAddressKeygen(mpcAddress: string): Promise<void> {
        if (!this.contractInstances.bridge) {
            throw new Error("Bridge contract not deployed. Call deployBridgeContract first.");
        }

        if (!ethers.utils.isAddress(mpcAddress)) {
            throw new Error(`Invalid MPC address format: ${mpcAddress}`);
        }

        try {
            console.log(`Finalizing key generation process with MPC address: ${mpcAddress}`);

            const tx = await this.contractInstances.bridge.endKeygen(mpcAddress);
            const receipt = await tx.wait();

            console.log(`Key generation process finalized successfully. Transaction hash: ${receipt.transactionHash}`);
        } catch (error) {
            console.error(`Failed to finalize key generation: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to finalize key generation with MPC address ${mpcAddress}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async executeProposal(
        proposal: BridgeProposal,
        proposalSignedData: string,
        gasLimit: number = 500000
    ): Promise<void> {
        if (!this.contractInstances.bridge) {
            throw new Error("Bridge contract not deployed. Call deployBridgeContract first.");
        }

        if (!proposal || !proposal.resourceID) {
            throw new Error("Invalid proposal object");
        }

        if (!proposalSignedData || !proposalSignedData.startsWith('0x')) {
            throw new Error("Invalid proposal signature format");
        }

        try {
            console.log(`Executing proposal for resource ${proposal.resourceID} from domain ${proposal.originDomainID} with nonce ${proposal.depositNonce}`);

            const executeTx = await this.contractInstances.bridge.executeProposal(
                proposal,
                proposalSignedData,
                { gasLimit: gasLimit }
            );
            const receipt = await executeTx.wait();

            console.log(`Proposal executed successfully. Transaction hash: ${receipt.transactionHash}`);
        } catch (error) {
            console.error("Failed to execute proposal:", error);
            throw new Error(`Failed to execute proposal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async createProposal(
        depositNonce: number,
        resourceID: string,
        depositProposalData: string,
    ): Promise<BridgeProposal> {
        if (depositNonce < 0) {
            throw new Error(`Invalid depositNonce: ${depositNonce}. Must be non-negative.`);
        }

        if (!resourceID || !resourceID.startsWith('0x') || resourceID.length !== 66) {
            throw new Error(`Invalid resourceID: ${resourceID}. Must be a 32-byte hex string.`);
        }
        try {
            return {
                originDomainID: this.domainId,
                depositNonce: depositNonce,
                resourceID: resourceID,
                data: depositProposalData,
            };
        } catch (error) {
            console.error('Error create proposal:', error);
            throw new Error(`Failed to create proposal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async createProposalSignedData(
        proposal: BridgeProposal,
        mpcPrivateKey: string,
        chainId: number,
    ): Promise<string> {
        if (!this.contractInstances.bridge) {
            throw new Error("Bridge contract not deployed. Call deployBridgeContract first.");
        }

        if (!mpcPrivateKey || !mpcPrivateKey.startsWith('0x')) {
            throw new Error('Invalid MPC private key format. Must be a hex string starting with 0x.');
        }

        try {
            return signTypedProposal(
                this.contractInstances.bridge.address,
                [proposal],
                mpcPrivateKey,
                chainId,
            );
        } catch (error) {
            console.error('Error signing proposal:', error);
            throw new Error(`Failed to sign proposal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    createERCDepositData(
        tokenAmountOrID: string | any,
        lenRecipientAddress: number | any,
        recipientAddress: string
    ): string {
        return (
            "0x" +
            toHex(tokenAmountOrID, 32).substring(2) + // Token amount or ID to deposit (32 bytes)
            toHex(lenRecipientAddress, 32).substring(2) + // len(recipientAddress)          (32 bytes)
            recipientAddress.substring(2)
        );
    };

    createResourceId(contractAddress: string): string {
        if (!ethers.utils.isAddress(contractAddress)) {
            throw new Error(`Invalid contract address: ${contractAddress}`);
        }

        const normalizedAddress = contractAddress.toLowerCase().replace('0x', '');
        const domainHex = ethers.utils.hexZeroPad(ethers.BigNumber.from(this.domainId).toHexString(), 1).slice(2);
        const combined = normalizedAddress + domainHex;

        return ethers.utils.hexZeroPad('0x' + combined, 32);
    }

    async disconnect(): Promise<void> {
        if (this.provider) {
            this.provider.removeAllListeners();
        }
    }
}



// const bridge = new Bridge(1);
// const resourceId = bridge.createERCDepositData(100, 20, "");
// console.log(resourceId)
