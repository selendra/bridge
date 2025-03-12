import { ethers } from "ethers";
import { BridgeClient } from "./utils/bridges";
import { HandlerType } from "./types";

// Example of transferring ERC20 tokens from Ethereum to Polygon
async function transferERC20Token() {
  try {
    const bridgeConfig = {
        sourceChain: {
          rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/",
          bridgeAddress: "0xA6935d6214f8bdb347191B34287751E15Bc77A0c", // Source chain bridge address
          domainId: 1 // Source chain domain ID
        },
        destinationChain: {
          rpcUrl: "https://eth-holesky.g.alchemy.com/v2/",
          bridgeAddress: "h0x9BB0807Ac05a1D511E54a4942279207cEd932997", // Destination chain bridge address
          domainId: 2 // Destination chain domain ID
        }
      };

    // Create a bridge client
    const bridgeClient = new BridgeClient(bridgeConfig);

    // Connect wallet to source chain (Ethereum)
    const sourcePrivateKey = "private key"; // Replace with your private key
    const sourceSigner = new ethers.Wallet(sourcePrivateKey, new ethers.providers.JsonRpcProvider(bridgeConfig.sourceChain.rpcUrl));
    bridgeClient.connectSourceSigner(sourceSigner);

    // Resource configuration for the token you want to transfer
    const resourceConfig = {
      resourceId: "0x0000000000000000000000257e64fbac41a29622e64e0d549dbe3dcdbfd91401", // Resource ID for the token
      sourceHandlerAddress: "0x212968e6757f5d95b9A0522b5b5c118fd3A67F84", // Handler address on source chain
      destinationHandlerAddress: "0x8DB6460717532bB869c79fEFCD96D392D61A7300", // Handler address on destination chain
      tokenAddress: "0x257E64fBaC41A29622E64E0D549dBe3dCdbfD914" // Token address on source chain
    };

    // Approve the token for transfer
    console.log("Approving tokens...");
    const amount = ethers.utils.parseUnits("1.0", 18); // Transfer 10 tokens with 18 decimals
    await bridgeClient.approveTokens(
      HandlerType.ERC20,
      resourceConfig.sourceHandlerAddress,
      resourceConfig.tokenAddress,
      amount
    );
    console.log("Tokens approved");
    
    // Perform the deposit (initiate the transfer)
    console.log("Depositing tokens...");
    const depositResult = await bridgeClient.deposit(
      resourceConfig,
      {
        handlerType: HandlerType.ERC20,
        recipient: "0x16b30190055E1bdd45268c9982e6D00Fd23AB355", // Recipient address on destination chain
        amount: amount,
        tokenAddress: resourceConfig.tokenAddress
      },
    );
    
    console.log("Deposit successful:");
    console.log("- Deposit Nonce:", depositResult.depositNonce.toString());
    console.log("- Transaction Hash:", depositResult.transactionHash);
    
    console.log("\nWaiting for MPC to sign and relayer to execute on destination chain...");
    console.log("(In a real application, you would monitor events or have a service do this)");
    
    // In a real scenario, a relayer would execute the proposal on the destination chain
    // with the MPC signature, but for this example we just show the deposit flow.

  } catch (error) {
    console.error("Error transferring tokens:", error);
  }
}

// Run the example
transferERC20Token().then(() => console.log("Done"));