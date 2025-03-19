import { ethers, utils } from "ethers";
import { bridgeContract, bridgeContractMethods } from "../constantd";
import { BridgeProposal } from "../interface";
const ethSigUtil = require("eth-sig-util");

const generateAccessControlFuncSignatures = () =>{
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

export const signTypedProposal = (
  bridgeAddress: string,
  proposals: BridgeProposal[],
  mpcPrivateKey: string,
  chainId: number,
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

export const toHex = (covertThis: any, padding: any) => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

export const accessControlFuncSignatures = generateAccessControlFuncSignatures().map(e => e.hash);