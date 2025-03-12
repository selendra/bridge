import { ethers } from "ethers";
import { BridgeClient } from "./utils/bridges";

// Example of monitoring bridge events
async function monitorBridgeEvents() {
  // Configuration for the bridge client
  const bridgeConfig = {
    sourceChain: {
      rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/api",
      bridgeAddress: "0xA6935d6214f8bdb347191B34287751E15Bc77A0c", // Source chain bridge address
      domainId: 1 // Source chain domain ID
    },
    destinationChain: {
      rpcUrl: "https://eth-holesky.g.alchemy.com/v2/api",
      bridgeAddress: "h0x9BB0807Ac05a1D511E54a4942279207cEd932997", // Destination chain bridge address
      domainId: 2 // Destination chain domain ID
    }
  };

  // Create a bridge client
  const bridgeClient = new BridgeClient(bridgeConfig);

  console.log("Starting to monitor bridge events...");
  
  // Listen for deposit events on the source chain
  bridgeClient.onDeposit((event: any) => {
    const { destinationDomainID, resourceID, depositNonce, user, data, handlerResponse } = event;
    
    console.log("\n--- New Deposit Event ---");
    console.log("Destination Domain ID:", destinationDomainID);
    console.log("Resource ID:", resourceID);
    console.log("Deposit Nonce:", depositNonce.toString());
    console.log("User Address:", user);
    console.log("Data:", data);
    console.log("Handler Response:", handlerResponse);
  });
  
  // Listen for proposal execution events on the destination chain
  bridgeClient.onProposalExecution((event: any) => {
    const { originDomainID, depositNonce, dataHash, handlerResponse } = event;
    
    console.log("\n--- New Proposal Execution Event ---");
    console.log("Origin Domain ID:", originDomainID);
    console.log("Deposit Nonce:", depositNonce.toString());
    console.log("Data Hash:", dataHash);
    console.log("Handler Response:", handlerResponse);
  });
  
  // Listen for failed handler execution events on the destination chain
  bridgeClient.onFailedHandlerExecution((event: any) => {
    const { lowLevelData, originDomainID, depositNonce } = event;
    
    console.log("\n--- Failed Handler Execution Event ---");
    console.log("Origin Domain ID:", originDomainID);
    console.log("Deposit Nonce:", depositNonce.toString());
    console.log("Error Data:", lowLevelData);
  });
  
  console.log("Event listeners set up. Monitoring bridge events...");
  console.log("Press Ctrl+C to stop monitoring.");
  
  // Keep the script running
  await new Promise(() => {});
}

// Run the monitoring example
monitorBridgeEvents().catch(console.error);