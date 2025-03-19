import { ethers } from "ethers";
import { IContractInstances } from "../type";
import { BridgeContractJson, Erc20ContractJson } from "../configs";

export class BridgeDeposit {
    private contractInstances: IContractInstances = {};
    private readonly wallet: ethers.Wallet;
    private readonly provider: ethers.providers.JsonRpcProvider;

    constructor(providerUrl?: string, privateKey?: string) {
        if (!providerUrl) {
            throw new Error("Provider URL is not defined");
        }

        if (!privateKey) {
            throw new Error("Private key is not defined");
        }

        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    getErc20Contract(address: string): void {
        if (!ethers.utils.isAddress(address)) {
            throw new Error(`Invalid contract address: ${address}`);
        }
        this.contractInstances.erc20 = new ethers.Contract(address, Erc20ContractJson.abi, this.wallet);
    }

    getBridgeContract(address: string): void {
        if (!ethers.utils.isAddress(address)) {
            throw new Error(`Invalid contract address: ${address}`);
        }
        this.contractInstances.bridge = new ethers.Contract(address, BridgeContractJson.abi, this.wallet);
    }

    async erc20Approve(
        erc20HandlerAddress: string,
        depositAmount: ethers.BigNumberish
    ): Promise<void> {
        if (!this.contractInstances.erc20) {
            throw new Error("ERC20 contract not deployed. Deploy ERC20 contract first.");
        }

        if (!ethers.utils.isAddress(erc20HandlerAddress)) {
            throw new Error(`Invalid ERC20 handler address: ${erc20HandlerAddress}`);
        }

        if (!depositAmount || ethers.BigNumber.from(depositAmount).lte(0)) {
            throw new Error(`Invalid deposit amount: ${depositAmount}. Must be greater than 0.`);
        }

        try {
            const tokenSymbol = await this.contractInstances.erc20.symbol();
            const decimals = await this.contractInstances.erc20.decimals();
            const formattedAmount = ethers.utils.formatUnits(depositAmount, decimals);

            console.log(`Approving ${formattedAmount} ${tokenSymbol} to be spent by handler at ${erc20HandlerAddress}`);

            const approveTx = await this.contractInstances.erc20
                .connect(this.wallet)
                .approve(erc20HandlerAddress, depositAmount);

            const receipt = await approveTx.wait();

            console.log(`Approval successful. Transaction hash: ${receipt.transactionHash}`);
        } catch (error) {
            console.error("Failed to approve ERC20 tokens:", error);
            throw new Error(`Failed to approve ERC20 tokens: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deposit(
        destinationDomainID: number,
        originResourceID: string,
        depositData: string,
        feeData: string = "0x"
    ): Promise<void> {
        if (!this.contractInstances.bridge) {
            throw new Error("Bridge contract not deployed. Call deployBridgeContract first.");
        }

        if (destinationDomainID < 0 || destinationDomainID > 255) {
            throw new Error(`Invalid destinationDomainID: ${destinationDomainID}. Must be between 0 and 255.`);
        }

        if (!originResourceID || !originResourceID.startsWith('0x') || originResourceID.length !== 66) {
            throw new Error(`Invalid originResourceID: ${originResourceID}. Must be a 32-byte hex string.`);
        }

        if (!depositData || !depositData.startsWith('0x')) {
            throw new Error(`Invalid depositData: ${depositData}. Must be a hex string.`);
        }

        try {
            console.log(`Initiating deposit to domain ${destinationDomainID} for resource ${originResourceID}`);

            const depositTx = await this.contractInstances.bridge.deposit(
                destinationDomainID,
                originResourceID,
                depositData,
                feeData
            );

            console.log(`Deposit transaction submitted. Waiting for confirmation...`);

            const receipt = await depositTx.wait();

            // Get deposit event details for more informative logging
            const depositEvent = receipt.events?.find((e: { event: string; }) => e.event === 'Deposit');
            const depositNonce = depositEvent?.args?.depositNonce;

            console.log(`Deposit successful! Transaction hash: ${receipt.transactionHash}`);
            if (depositNonce) {
                console.log(`Deposit nonce: ${depositNonce}`);
            }

        } catch (error) {
            console.error("Failed to deposit assets:", error);
            throw new Error(`Failed to deposit assets: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.provider) {
            this.provider.removeAllListeners();
        }
    }
}