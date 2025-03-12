import assert from "assert";
import { ethers, utils } from "ethers";
import { resolve } from "path";
const fs = require("fs");
require("dotenv").config();

export const BRIDGE_CONTRACT_PATH = resolve(__dirname, "../../smart-contracts/contracts/Bridge.sol");
export const BRIDGE_CONTRACT_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/Bridge.json");
export const BridgeContractJson = JSON.parse(fs.readFileSync(BRIDGE_CONTRACT_ARTIFACTS_PATH, "utf8"));
export const bridgeContractMethods = BridgeContractJson.userdoc.methods;
export const bridgeContract = fs.readFileSync(BRIDGE_CONTRACT_PATH);

export const ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/AccessControlSegregator.json");
export const AccessControlSegregatorContractJson = JSON.parse(fs.readFileSync(ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH, "utf8"));

export const ERC20_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/ERC20PresetMinterPauser.json");
export const Erc20ContractJson = JSON.parse(fs.readFileSync(ERC20_ARTIFACTS_PATH, "utf8"));

export const ERC20_HANDLER_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/ERC20Handler.json");
export const Erc20HandlerContractJson = JSON.parse(fs.readFileSync(ERC20_HANDLER_ARTIFACTS_PATH, "utf8"));

export const DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH = resolve(__dirname, "../../smart-contracts/build/contracts/DefaultMessageReceiver.json");
export const DefaultMessageReceiverContractJson = JSON.parse(fs.readFileSync(DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH, "utf8"));

export const bridge_address = "0x5D5b7cb61125573B5027C781b06AEda6d2aC22AC";
export const erc20Handler_address = "0x67ba9268e1ebf588aa5F06d331E8Aa39496b2dbD";
export const erc20_addres = "0x5267DCb8ee5796f1F66c4eB26ca79B2fe7068e71";

export const dest_bridge_address = "0xf383f70D6f233f16966AeF8b33299083fdf5B5E1";
export const dest_erc20Handler_address = "0x6ff8b7EbCE2360De3C81d9cB14693aa3be39a66c";
export const dest_erc20_addres = "0xc59BDB6dc022777bcb80845DBBEa77D318886CAE";

export const provider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_PROVIDER_URL);
export const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "", provider);
export const depositWallet = new ethers.Wallet(process.env.DEPOSIT_PRIVATE_KEY ? process.env.DEPOSIT_PRIVATE_KEY : "", provider);

export const destProvider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_PROVIDER_URL);
export const destwallet = new ethers.Wallet(process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "", destProvider);
export const destdepositWallet = new ethers.Wallet(process.env.DEPOSIT_PRIVATE_KEY ? process.env.DEPOSIT_PRIVATE_KEY : "", destProvider);

export const mpcAddress = wallet.address
export const mpcPrivateKey = wallet.privateKey;