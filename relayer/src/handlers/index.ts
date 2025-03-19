import { ethers } from "ethers";

export { Bridge } from "./bridge";
export { BridgeDeposit } from "./deposit";

const checkERC20Balance = async(
    tokenAddress: string,
    accountAddress: string,
    provider: ethers.providers.Provider
): Promise<{amount: ethers.BigNumber, formatted: string}> => {
    try {
        // Validate addresses
        if (!ethers.utils.isAddress(tokenAddress)) {
            throw new Error(`Invalid token address: ${tokenAddress}`);
        }
        
        if (!ethers.utils.isAddress(accountAddress)) {
            throw new Error(`Invalid account address: ${accountAddress}`);
        }
        
        // Create a contract instance for the token
        const tokenContract = new ethers.Contract(
            tokenAddress,
            [
                'function balanceOf(address owner) view returns (uint256)',
                'function symbol() view returns (string)',
                'function decimals() view returns (uint8)',
            ],
            provider
        );
        
        // Get token details
        let decimals: number;
        let tokenSymbol: string;
        
        try {
            decimals = await tokenContract.decimals();
            tokenSymbol = await tokenContract.symbol();
        } catch (error) {
            console.warn("Could not get token details:", error);
            decimals = 18; // Default to 18 decimals
            tokenSymbol = "TOKEN"; // Default symbol
        }
        
        // Get the balance
        const balance = await tokenContract.balanceOf(accountAddress);
        
        // Format the balance
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
        
        console.log(`Balance for ${accountAddress}: ${formattedBalance} ${tokenSymbol}`);
        
        return {
            amount: balance,
            formatted: `${formattedBalance} ${tokenSymbol}`
        };
    } catch (error) {
        console.error("Failed to check ERC20 balance:", error);
        throw new Error(`Failed to check ERC20 balance: ${error instanceof Error ? error.message : String(error)}`);
    }
}