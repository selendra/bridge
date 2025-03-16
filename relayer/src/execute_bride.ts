import { ethers, utils } from "ethers";
const ethSigUtil = require("eth-sig-util");
import { 
  AccessControlSegregatorContractJson,
  bridge_address,
  bridgeContract, BridgeContractJson,
  bridgeContractMethods,
  DefaultMessageReceiverContractJson,
  depositWallet,
  dest_bridge_address,
  dest_erc20_addres,
  dest_erc20Handler_address,
  destwallet,
  erc20_addres,
  Erc20ContractJson, erc20Handler_address, Erc20HandlerContractJson, 
  mpcAddress, 
  mpcPrivateKey,
  wallet
} from "./constantd";
require("dotenv").config();


function generateAccessControlFuncSignatures() {
  // regex that will match all functions that have "onlyAllowed" modifier
  const regex = RegExp("function\\s+(?:(?!_onlyAllowed|function).)+onlyAllowed", "gs");

  let a;
  const b: any = [];
  // fetch all functions that have "onlyAllowed" modifier from "Bridge.sol"
  while ((a = regex.exec(bridgeContract)) !== null) {
    // filter out only function name from matching (onlyAllowed) functions
    b.push(a[0].split(/[\s()]+/)[1]);
  }

  let accessControlFuncSignatures = []
  // filter out from Bridge ABI functions signatures with "onlyAllowed" modifier
  accessControlFuncSignatures = Object.keys(bridgeContractMethods).filter(
    el1 => b.some(
      (el2: any) => el1.includes(el2))).map(
        func => ({
          function: func,
          hash: utils.keccak256(Buffer.from(func)).substring(0, 10)
        })
      );
  return accessControlFuncSignatures;
}

const createResourceID = (contractAddress: string, domainID: number) => {
  // Ensure contractAddress is properly formatted (remove '0x' if present)
  const cleanAddress = contractAddress.toLowerCase().replace('0x', '');
  const domainHex = ethers.utils.hexZeroPad(ethers.BigNumber.from(domainID).toHexString(), 1).slice(2);
  const combined = cleanAddress + domainHex;
  const resourceID = ethers.utils.hexZeroPad('0x' + combined, 32);
  return resourceID;
};

const toHex = (covertThis: any, padding: any) => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

const createERCDepositData = (
  tokenAmountOrID: any,
  lenRecipientAddress: any,
  recipientAddress: string
) => {
  return (
    "0x" +
    toHex(tokenAmountOrID, 32).substring(2) + // Token amount or ID to deposit (32 bytes)
    toHex(lenRecipientAddress, 32).substring(2) + // len(recipientAddress)          (32 bytes)
    recipientAddress.substring(2)
  );
};

const accessControlFuncSignatures = generateAccessControlFuncSignatures().map(e => e.hash);

const deployBridge = async (wallet: ethers.Wallet, domainID: number, admin: string) => {
  const accessControlSegregatorContract = new ethers.ContractFactory(
    AccessControlSegregatorContractJson.abi,
    AccessControlSegregatorContractJson.bytecode,
    wallet
  );
  const BridgeContract = new ethers.ContractFactory(
    BridgeContractJson.abi,
    BridgeContractJson.bytecode,
    wallet
  );


  const accessControlInstance = await accessControlSegregatorContract.deploy(
    accessControlFuncSignatures, Array(13).fill(admin));

  return await BridgeContract.deploy(domainID, accessControlInstance.address);
};

const deployErc20 = async (wallet: ethers.Wallet) => {
  const erc20Contract = new ethers.ContractFactory(
    Erc20ContractJson.abi,
    Erc20ContractJson.bytecode,
    wallet
  );

  return erc20Contract.deploy("token", "TOK");
}

const deployErc20Handler = async (wallet: ethers.Wallet, bridgeAdress: string) => {
  const defaultMessageReceiverContract = new ethers.ContractFactory(
    DefaultMessageReceiverContractJson.abi,
    DefaultMessageReceiverContractJson.bytecode,
    wallet
  );

  const defaultMessageReceiverInstance = await defaultMessageReceiverContract.deploy(
    [],
    100000
  );

  const erc20HandlerContract = new ethers.ContractFactory(
    Erc20HandlerContractJson.abi,
    Erc20HandlerContractJson.bytecode,
    wallet
  );

  return erc20HandlerContract.deploy(bridgeAdress, defaultMessageReceiverInstance.address);
}

const bridge_deposit = async (
  wallet: ethers.Wallet,
  bridgeInstance: ethers.Contract,
  destinationDomainID: number,
  resourceID: string,
  depositData: string,
  feeData: string,
) => {
  const depositTx = await bridgeInstance
    .connect(wallet)
    .deposit(
      destinationDomainID,
      resourceID,
      depositData,
      feeData
    )
  await depositTx.wait();
  console.log("Deposit Successful:", depositTx.hash);
}

const deploy_bridge = async(
  wallet: ethers.Wallet,
  adminAddress: string,
  mpcAddress: string,
  domainId: number
) => {
  const bridgeInstance = await deployBridge(wallet, domainId, adminAddress);
  const erc20HandlerInstance = await deployErc20Handler(wallet, bridgeInstance.address);
  const erc20Instance = await deployErc20(wallet);

  console.table({
    "Bridge Address": bridgeInstance.address,
    "ERC20Handler Address": erc20HandlerInstance.address,
    "ERC20 Address": erc20Instance.address
  });

  // set MPC address to unpause the Bridge
  await bridgeInstance.endKeygen(mpcAddress);
}

const bridge_call = async (bridgeAddress: string, wallet: ethers.Wallet) => {
  return new ethers.Contract(bridgeAddress, BridgeContractJson.abi, wallet);
}

const erc20_call = async (erc20Address: string, wallet: ethers.Wallet) => {
  return new ethers.Contract(erc20Address, Erc20ContractJson.abi, wallet);
}

const erc20Handler_call = async (erc20HandlerAddress: string, wallet: ethers.Wallet) => {
  return new ethers.Contract(erc20HandlerAddress, Erc20HandlerContractJson.abi, wallet);
}

const erc20Approve = async (
  wallet: ethers.Wallet,
  erc20Instance: ethers.Contract,
  erc20HandlerAdress: string,
  depositAmount: number,
) => {
  const approveTx = await erc20Instance
    .connect(wallet)
    .approve(erc20HandlerAdress, depositAmount);

  await approveTx.wait();
  console.log("Approval Successful:", approveTx.hash);
}

const erc20GranRole = async (
  wallet: ethers.Wallet,
  erc20Instance: ethers.Contract,
  erc20HandlerAdress: string,
) => {
  const grantRoleTx = await erc20Instance
    .connect(wallet)
    .grantRole(
      await erc20Instance.MINTER_ROLE(),
      erc20HandlerAdress
    );

  await grantRoleTx.wait();
  console.log("GrandMintRole Successful:", grantRoleTx.hash);
}

const bridgeSetUpBurnAble = async (
  wallet: ethers.Wallet,
  bridgeInstance: ethers.Contract,
  erc20HandlerAdress: string,
  erc20Address: string
) => {
  const setUpBurnAbleTx = await bridgeInstance
    .connect(wallet)
    .adminSetBurnable(
      erc20HandlerAdress,
      erc20Address
    );

    await setUpBurnAbleTx.wait();
    console.log("GrandMintRole Successful:", setUpBurnAbleTx.hash);
}

const setup_bridge = async (
  bridgeInstance: ethers.Contract,
  erc20Instance: ethers.Contract,
  erc20HandlerInstance: ethers.Contract,
  domainID: number,
  depositorAddress: string,
  initialTokenAmount: number,
  emptySetResourceData: string
) => {
  const resourceID = createResourceID(
    erc20Instance.address,
    domainID
  );

  console.log("starting set_resource");
  await bridgeInstance.adminSetResource(
    erc20HandlerInstance.address,
    resourceID,
    erc20Instance.address,
    emptySetResourceData
  );

  console.log("starting mint");
  await erc20Instance.mint(depositorAddress, initialTokenAmount);
}


const signTypedProposal = (
  bridgeAddress: string,
  proposals: any,
  chainId: number = 1,
) => {
  const name = "Bridge";
  const version = "3.1.0";

  const EIP712Domain = [
    {name: "name", type: "string"},
    {name: "version", type: "string"},
    {name: "chainId", type: "uint256"},
    {name: "verifyingContract", type: "address"},
  ];

  const types = {
    EIP712Domain: EIP712Domain,
    Proposal: [
      {name: "originDomainID", type: "uint8"},
      {name: "depositNonce", type: "uint64"},
      {name: "resourceID", type: "bytes32"},
      {name: "data", type: "bytes"},
    ],
    Proposals: [{name: "proposals", type: "Proposal[]"}],
  };

  return ethSigUtil.signTypedMessage(ethers.utils.arrayify(mpcPrivateKey), {
    data: {
      types: types,
      domain: {
        name,
        version,
        chainId,
        verifyingContract: bridgeAddress,
      },
      primaryType: "Proposals",
      message: {
        proposals: proposals,
      },
    },
  });
};

const createProposal = async (
  destBridgeInstance: ethers.Contract,
  originDomainID: number,
  depositNonce: number,
  resourceID: string,
  depositProposalData: string,
  chainId: number
) => {
  const proposal = {
    originDomainID: originDomainID,
    depositNonce: depositNonce,
    resourceID: resourceID,
    data: depositProposalData,
  };

  const proposalSignedData = signTypedProposal(
    destBridgeInstance.address,
    [proposal],
    chainId
  );

  const executeTx = await destBridgeInstance
    .executeProposal(proposal, proposalSignedData);

  await executeTx.wait();
  console.log("Proposal Executed:", executeTx.hash);
    
}


async function main() {
  const originDomainID = 1;
  const destinationDomainID = 2;
  const emptySetResourceData = "0x";
  const feeData = "0x";
  const adminAddress = wallet.address;
  const depositorAddress = "0xB8413a476ca0dCD538b81d3BF41919C634C3675a";
  const recipientAddress = "0x1Ad4b1efE3Bc6FEE085e995FCF48219430e615C3";
  const initialTokenAmount = 1000000;
  const depositAmount = 10;

  const bridgeInstance = await bridge_call(bridge_address, wallet);
  const erc20Instance = await erc20_call(erc20_addres, wallet);
  const erc20HandlerInstance = await erc20Handler_call(erc20Handler_address, wallet);

  const destBridgeInstance = await bridge_call(dest_bridge_address, destwallet);
  const destErc20Instance = await erc20_call(dest_erc20_addres, destwallet);
  const destEc20HandlerInstance = await erc20Handler_call(dest_erc20Handler_address, destwallet);

  const resourceID = createResourceID(
    erc20Instance.address,
    originDomainID
  );

  const destResourceID = createResourceID(
    destErc20Instance.address,
    destinationDomainID
  );

  // console.log("origin bridge starting deploying");
  // await deploy_bridge(wallet, adminAddress, mpcAddress, originDomainID);
  // console.log("destination bridge starting deploying");
  // await deploy_bridge(destwallet, adminAddress, mpcAddress, destinationDomainID);

  // await setup_bridge(
  //   bridgeInstance,
  //   erc20Instance,
  //   erc20HandlerInstance,
  //   originDomainID,
  //   depositorAddress,
  //   initialTokenAmount,
  //   emptySetResourceData
  // );

  // await setup_bridge(
  //   destBridgeInstance,
  //   destErc20Instance,
  //   destEc20HandlerInstance,
  //   destinationDomainID,
  //   depositorAddress,
  //   initialTokenAmount,
  //   emptySetResourceData
  // );

  //  await erc20GranRole(wallet, erc20Instance, erc20Handler_address);
  //  await erc20GranRole(destwallet, destErc20Instance, dest_erc20Handler_address);
  // await bridgeSetUpBurnAble(destwallet, destBridgeInstance, dest_erc20Handler_address, dest_erc20_addres);

  // let isPaused = await bridgeInstance.paused();
  // console.log(`isPaused ${isPaused}`);

  // let isDestPaused = await destBridgeInstance.paused();
  // console.log(`isDestPaused ${isDestPaused}`);

  // console.log("starting approve");
  // await erc20Approve(depositWallet, erc20Instance, erc20HandlerInstance.address, depositAmount);

  // // create deposit data
  // const depositData = createERCDepositData(depositAmount, 5, recipientAddress);

  // // check depositorBalance of original chain
  // let depositorBalance = await erc20Instance.balanceOf(depositorAddress);
  // console.log(`current depositorBalance ${depositorBalance}`);

  // console.log("starting bridge deposit");
  // await bridge_deposit(depositWallet, bridgeInstance, destinationDomainID, resourceID, depositData, feeData);

  // /// check latest deposit nonce
  // const depositNonce = await bridgeInstance._depositCounts(
  //   destinationDomainID
  // );
  // console.log(`Bridge deposit nonce ${depositNonce}`);

  // // check depositorBalance of destination chain
  let dest_depositorBalance = await destErc20Instance.balanceOf(recipientAddress);
  // console.log(`current dest depositorBalance ${dest_depositorBalance}`);
  
  // await createProposal(destBridgeInstance, originDomainID, Number(depositNonce), destResourceID, depositData, 11155111);

   // check depositorBalance of destination chain after bridge
  dest_depositorBalance = await destErc20Instance.balanceOf(recipientAddress);
  console.log(`after bridge depositorBalance ${dest_depositorBalance}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });