import assert from "assert";
import { ethers, utils } from "ethers";
import { resolve } from "path";
const fs = require("fs");
require("dotenv").config();

const BRIDGE_CONTRACT_PATH = resolve(__dirname, "../../smart-contracts/contracts/Bridge.sol");
const BRIDGE_CONTRACT_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/Bridge.json");
const BridgeContractJson = JSON.parse(fs.readFileSync(BRIDGE_CONTRACT_ARTIFACTS_PATH, "utf8"));

const ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/AccessControlSegregator.json");
const AccessControlSegregatorContractJson = JSON.parse(fs.readFileSync(ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH, "utf8"));

const ERC20_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/ERC20PresetMinterPauser.json");
const Erc20ContractJson = JSON.parse(fs.readFileSync(ERC20_ARTIFACTS_PATH, "utf8"));

const ERC20_HANDLER_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/ERC20Handler.json");
const Erc20HandlerContractJson = JSON.parse(fs.readFileSync(ERC20_HANDLER_ARTIFACTS_PATH, "utf8"));

const DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/DefaultMessageReceiver.json");
const DefaultMessageReceiverContractJson = JSON.parse(fs.readFileSync(DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH, "utf8"));


function generateAccessControlFuncSignatures() {
  const bridgeAbiJson = JSON.parse(fs.readFileSync(BRIDGE_CONTRACT_ARTIFACTS_PATH));
  const bridgeContractMethods = bridgeAbiJson.userdoc.methods
  const bridgeContract = fs.readFileSync(BRIDGE_CONTRACT_PATH);

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

const erc20Approve = async (
  wallet: ethers.Wallet,
  erc20Instance: ethers.Contract,
  erc20HandlerAdress: string,
  depositAmount: number,
) => {
  const approveTx = await erc20Instance
    .connect(wallet)
    .approve(erc20HandlerAdress, depositAmount * 2);

  await approveTx.wait();
  console.log("Approval Successful:", approveTx.hash);
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

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_PROVIDER_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "", provider);
  const depositWallet = new ethers.Wallet(process.env.DEPOSIT_PRIVATE_KEY ? process.env.DEPOSIT_PRIVATE_KEY : "", provider);
  const mpcAddress = wallet.address

  const originDomainID = 1;
  const destinationDomainID = 2;
  const emptySetResourceData = "0x";
  const feeData = "0x";
  const adminAddress = wallet.address;
  const depositorAddress = "0xB8413a476ca0dCD538b81d3BF41919C634C3675a";
  const recipientAddress = "0x1Ad4b1efE3Bc6FEE085e995FCF48219430e615C3";
  const initialTokenAmount = 100;
  const depositAmount = 10;

  const bridgeInstance = await deployBridge(wallet, 1, adminAddress);
  const erc20HandlerInstance = await deployErc20Handler(wallet, bridgeInstance.address);
  const erc20Instance = await deployErc20(wallet);

  console.table({
    "Deployer Address": adminAddress,
    "Bridge Address": bridgeInstance.address,
    "ERC20Handler Address": erc20HandlerInstance.address,
    "ERC20 Address": erc20Instance.address
  });

  // set MPC address to unpause the Bridge
  await bridgeInstance.endKeygen(mpcAddress);

  const resourceID = createResourceID(
    erc20Instance.address,
    originDomainID
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

  console.log("starting approve");
  await erc20Approve(depositWallet, erc20Instance, erc20HandlerInstance.address, depositAmount);

  const depositData = createERCDepositData(depositAmount, 20, recipientAddress);

  const depositorBalance = await erc20Instance.balanceOf(depositorAddress);
  console.log(`current depositorBalance ${depositorBalance}`);

  const handlerAllowance = await erc20Instance.allowance(depositorAddress, erc20HandlerInstance.address);
  console.log(`current handlerAllowance ${handlerAllowance}`);

  let isPaused = await bridgeInstance.paused();
  console.log(`isPaused ${isPaused}`);

  console.log("starting bridge deposit");
  await bridge_deposit(depositWallet, bridgeInstance, destinationDomainID, resourceID, depositData, feeData);
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });