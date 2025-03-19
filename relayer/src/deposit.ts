import { ethers } from "ethers";
import { IContractInstances } from "./interface";
import { Erc20ContractJson } from "./constantd";

class deposit {
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


    async erc20Approve() {

    }
}