import { ethers, Contract, BigNumber, Signer } from "ethers";
import {
  BridgeConfig,
  ResourceConfig,
  DepositData,
  DepositResult,
  FeeData,
  Proposal,
  ExecuteProposalResult,
  HandlerType
} from "../types";
import {
  BRIDGE_ABI,
  ERC20_ABI,
  ERC721_ABI,
  encodeERC20DepositData,
  encodeERC721DepositData,
  encodeGMPDepositData,
  pausableABI
} from "./constants";
import { verifyProposalSignature } from "./signature";

export class BridgeClient {
  private sourceProvider: ethers.providers.JsonRpcProvider;
  private destProvider: ethers.providers.JsonRpcProvider;
  private sourceBridge: Contract;
  private destBridge: Contract;
  private sourceSigner?: Signer;
  private destSigner?: Signer;
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;

    // Initialize providers
    this.sourceProvider = new ethers.providers.JsonRpcProvider(config.sourceChain.rpcUrl);
    this.destProvider = new ethers.providers.JsonRpcProvider(config.destinationChain.rpcUrl);

    // Initialize bridge contracts
    this.sourceBridge = new Contract(
      config.sourceChain.bridgeAddress,
      BRIDGE_ABI,
      this.sourceProvider
    );

    this.destBridge = new Contract(
      config.destinationChain.bridgeAddress,
      BRIDGE_ABI,
      this.destProvider
    );
  }

  /**
   * Connect a signer to interact with the source chain
   */
  public connectSourceSigner(signer: Signer): void {
    this.sourceSigner = signer;
    this.sourceBridge = this.sourceBridge.connect(signer);
  }

  /**
   * Connect a signer to interact with the destination chain
   */
  public connectDestinationSigner(signer: Signer): void {
    this.destSigner = signer;
    this.destBridge = this.destBridge.connect(signer);
  }

  /**
   * Approve tokens for transfer (needed before deposit)
   */
  public async approveTokens(
    handlerType: HandlerType,
    handlerAddress: string,
    tokenAddress: string,
    amount?: BigNumber,
    tokenId?: BigNumber
  ): Promise<string> {
    if (!this.sourceSigner) {
      throw new Error("No signer connected for source chain");
    }

    if (handlerType === HandlerType.ERC20) {
      if (!amount) {
        throw new Error("Amount is required for ERC20 approval");
      }

      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.sourceSigner);
        const signerAddress = await this.sourceSigner.getAddress();

        // Check token balance first
        const balance = await tokenContract.balanceOf(signerAddress);
        if (balance.lt(amount)) {
          throw new Error(`Insufficient token balance. Required: ${ethers.utils.formatUnits(amount)}, Available: ${ethers.utils.formatUnits(balance)}`);
        }

        // Check current allowance - avoid unnecessary approvals
        const currentAllowance = await tokenContract.allowance(signerAddress, handlerAddress);
        if (currentAllowance.gte(amount)) {
          console.log("Approval not needed - sufficient allowance already exists");
          return "0x0"; // No transaction needed
        }

        // If we need to increase allowance
        console.log("Setting approval with explicit gas limit...");

        // First set approval to 0 if not zero already (to handle certain ERC20 tokens that require this)
        if (currentAllowance.gt(0)) {
          const resetTx = await tokenContract.approve(handlerAddress, 0, {
            gasLimit: 100000 // Explicit gas limit
          });
          await resetTx.wait();
          console.log("Reset approval to zero first");
        }

        // Now set the actual approval
        const tx = await tokenContract.approve(handlerAddress, amount, {
          gasLimit: 100000 // Explicit gas limit
        });
        await tx.wait();

        return tx.hash;
      } catch (error: any) {
        console.error("Token approval error details:", error);

        // Provide more helpful error message
        if (error.message.includes("execution reverted")) {
          throw new Error(`Token approval failed. Please check: 
            1. The token contract at ${tokenAddress} is valid
            2. You have sufficient balance
            3. The handler address ${handlerAddress} is correct
            4. If this token has special approval requirements`);
        }
        throw error;
      }
    } else if (handlerType === HandlerType.ERC721) {
      if (!tokenId) {
        throw new Error("TokenId is required for ERC721 approval");
      }
      const tokenContract = new Contract(tokenAddress, ERC721_ABI, this.sourceSigner);

      try {
        const tx = await tokenContract.approve(handlerAddress, tokenId, {
          gasLimit: 150000 // Explicit gas limit
        });
        await tx.wait();
        return tx.hash;
      } catch (error: any) {
        console.error("NFT approval error details:", error);
        throw new Error(`NFT approval failed. Please check ownership of token ID ${tokenId}`);
      }
    }

    throw new Error(`Token approval not required for handler type: ${handlerType}`);
  }
  /**
   * Deposit assets to the bridge (send from source chain to destination chain)
   */
  public async deposit(
    resourceConfig: ResourceConfig,
    depositData: DepositData,
    feeData: FeeData = {}
  ): Promise<DepositResult> {
    if (!this.sourceSigner) {
      throw new Error("No signer connected for source chain");
    }
  
    try {
      // First, check if the bridge is paused
      const pausableContract = new Contract(this.config.sourceChain.bridgeAddress, pausableABI, this.sourceProvider);
      const isPaused = await pausableContract.paused();
      if (isPaused) {
        throw new Error("Bridge is currently paused - deposits are not allowed");
      }
  
      // Verify the handler is properly mapped for this resource ID
      const handlerMappingABI = ["function _resourceIDToHandlerAddress(bytes32) view returns (address)"];
      const bridgeForMapping = new Contract(this.config.sourceChain.bridgeAddress, handlerMappingABI, this.sourceProvider);
      const mappedHandler = await bridgeForMapping._resourceIDToHandlerAddress(resourceConfig.resourceId);
      
      if (mappedHandler === ethers.constants.AddressZero) {
        throw new Error(`Resource ID ${resourceConfig.resourceId} is not mapped to any handler`);
      }
  
      // Encode the deposit data based on handler type
      let encodedDepositData: string;
      
      switch (depositData.handlerType) {
        case HandlerType.ERC20:
          if (!depositData.amount) throw new Error("Amount required for ERC20 deposit");
          encodedDepositData = ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256"],
            [depositData.recipient, depositData.amount]
          );
          break;
        
        case HandlerType.ERC721:
          if (!depositData.tokenId) throw new Error("TokenId required for ERC721 deposit");
          encodedDepositData = ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "bytes"],
            [depositData.recipient, depositData.tokenId, depositData.metadata || "0x"]
          );
          break;
        
        case HandlerType.GMP:
          if (!depositData.calldata) throw new Error("Calldata required for GMP deposit");
          encodedDepositData = ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes"],
            [depositData.recipient, depositData.calldata]
          );
          break;
        
        default:
          throw new Error(`Unsupported handler type: ${depositData.handlerType}`);
      }
  
      // Encode fee data
      const encodedFeeData = feeData.tokenAddress && feeData.feeAmount
        ? ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256"],
            [feeData.tokenAddress, feeData.feeAmount]
          )
        : "0x";
  
      // Calculate value to send (if any)
      const value = feeData.feeAmount && !feeData.tokenAddress
        ? feeData.feeAmount
        : ethers.constants.Zero;
  
      console.log("Deposit parameters:");
      console.log(`- Destination Domain: ${this.config.destinationChain.domainId}`);
      console.log(`- Resource ID: ${resourceConfig.resourceId}`);
      console.log(`- Recipient: ${depositData.recipient}`);
      console.log(`- Amount/TokenId: ${depositData.amount?.toString() || depositData.tokenId?.toString() || 'N/A'}`);
      console.log(`- Native fee value: ${ethers.utils.formatEther(value)} ETH`);
  
      // Execute deposit transaction with explicit gas settings
      const tx = await this.sourceBridge.deposit(
        this.config.destinationChain.domainId,
        resourceConfig.resourceId,
        encodedDepositData,
        encodedFeeData,
        {
          gasLimit: 30000000, // Explicit gas limit to avoid estimation issues
        }
      );
  
      console.log(`Deposit transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Deposit confirmed in block ${receipt.blockNumber}`);
      
      // // Find the Deposit event from transaction logs
      // const depositEvent = receipt.events?.find(
      //   (event: any) => event.event === "Deposit" && 
      //     event.address.toLowerCase() === this.config.sourceChain.bridgeAddress.toLowerCase()
      // );
  
      // if (!depositEvent) {
      //   throw new Error("Deposit event not found in transaction receipt");
      // }
  
      // // Extract deposit nonce and handler response from the event
      // const { depositNonce, handlerResponse } = depositEvent.args;
  
      // return {
      //   depositNonce: BigNumber.from(depositNonce),
      //   transactionHash: tx.hash,
      //   handlerResponse
      // };

      return {
        depositNonce: BigNumber.from(10),
        transactionHash: "tx.hash",
        handlerResponse: ""
      };
    } catch (error: any) {
      console.error("Deposit error details:", error);
      
      // Provide better error messages based on common issues
      if (error.message.includes("execution reverted")) {
        // Try to decode the revert reason if possible
        try {
          // If there's data in the error, try to decode it
          if (error.data) {
            const reason = ethers.utils.toUtf8String(error.data);
            throw new Error(`Deposit reverted: ${reason}`);
          } 
        } catch (_) {
          // Couldn't decode, fallback to common errors
        }
        
        // Suggest common issues
        throw new Error(`Deposit failed. Common causes include:
          1. Bridge is paused
          2. Trying to send to same domain as source
          3. ResourceID not mapped to a valid handler
          4. Insufficient token approval
          5. Fee payment issues
          6. Missing or incorrect parameters
  
          Try checking bridge state and your token approvals.`);
      }
      
      throw error;
    }
  }

  /**
   * Execute a proposal on the destination chain (receive assets)
   */
  public async executeProposal(
    proposal: Proposal | Proposal[],
    signature: string
  ): Promise<ExecuteProposalResult> {
    if (!this.destSigner) {
      throw new Error("No signer connected for destination chain");
    }

    // Check if MPC signed this proposal
    const mpcAddress = await this.destBridge._MPCAddress();
    const chainId = (await this.destProvider.getNetwork()).chainId;

    const isValidSig = verifyProposalSignature(
      proposal,
      signature,
      mpcAddress,
      this.config.destinationChain.bridgeAddress,
      chainId
    );

    if (!isValidSig) {
      throw new Error("Invalid proposal signature");
    }

    try {
      let tx;

      if (Array.isArray(proposal)) {
        tx = await this.destBridge.executeProposals(proposal, signature);
      } else {
        tx = await this.destBridge.executeProposal(proposal, signature);
      }

      const receipt = await tx.wait();

      // Check for execution events
      const executionEvents = receipt.events?.filter(
        (event: ethers.Event) => event.event === "ProposalExecution"
      );

      const failedEvents = receipt.events?.filter(
        (event: ethers.Event) => event.event === "FailedHandlerExecution"
      );

      if (executionEvents && executionEvents.length > 0) {
        const handlerResponse = executionEvents[0].args.handlerResponse;
        return {
          transactionHash: tx.hash,
          success: true,
          handlerResponse
        };
      } else if (failedEvents && failedEvents.length > 0) {
        return {
          transactionHash: tx.hash,
          success: false,
          errorMessage: "Handler execution failed"
        };
      }

      return {
        transactionHash: tx.hash,
        success: true
      };
    } catch (error: any) {
      return {
        transactionHash: "",
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Check if a proposal has already been executed
   */
  public async isProposalExecuted(originDomainID: number, depositNonce: BigNumber): Promise<boolean> {
    return this.destBridge.isProposalExecuted(originDomainID, depositNonce);
  }

  /**
   * Listen for deposit events on the source chain
   */
  public onDeposit(callback: (event: any) => void): void {
    this.sourceBridge.on("Deposit", callback);
  }

  /**
   * Listen for proposal execution events on the destination chain
   */
  public onProposalExecution(callback: (event: any) => void): void {
    this.destBridge.on("ProposalExecution", callback);
  }

  /**
   * Listen for failed handler execution events on the destination chain
   */
  public onFailedHandlerExecution(callback: (event: any) => void): void {
    this.destBridge.on("FailedHandlerExecution", callback);
  }
}
