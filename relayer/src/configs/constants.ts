import { resolve } from "path";
const fs = require("fs");
require("dotenv").config();

export const BRIDGE_CONTRACT_PATH = resolve(__dirname, "../../../smart-contracts/contracts/Bridge.sol");
export const BRIDGE_CONTRACT_ARTIFACTS_PATH = resolve(__dirname, "./smart-contracts/Bridge.json");
export const BridgeContractJson = JSON.parse(fs.readFileSync(BRIDGE_CONTRACT_ARTIFACTS_PATH, "utf8"));
export const bridgeContractMethods = BridgeContractJson.userdoc.methods;
export const bridgeContract = fs.readFileSync(BRIDGE_CONTRACT_PATH);

export const ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH = resolve(__dirname, "./smart-contracts/AccessControlSegregator.json");
export const AccessControlSegregatorContractJson = JSON.parse(fs.readFileSync(ACCESS_CONTROL_SEGRESGATOR_ARTIFACTS_PATH, "utf8"));

export const ERC20_ARTIFACTS_PATH = resolve(__dirname, "./smart-contracts/ERC20PresetMinterPauser.json");
export const Erc20ContractJson = JSON.parse(fs.readFileSync(ERC20_ARTIFACTS_PATH, "utf8"));

export const ERC20_HANDLER_ARTIFACTS_PATH = resolve(__dirname, "./smart-contracts/ERC20Handler.json");
export const Erc20HandlerContractJson = JSON.parse(fs.readFileSync(ERC20_HANDLER_ARTIFACTS_PATH, "utf8"));

export const DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH = resolve(__dirname, "./smart-contracts/DefaultMessageReceiver.json");
export const DefaultMessageReceiverContractJson = JSON.parse(fs.readFileSync(DEFAULT_MESSAGE_RECEIVER_ARTIFACTS_PATH, "utf8"));