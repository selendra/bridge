const Helper = require("../helpers");
const Ethers = require("ethers");
const ethSigUtil = require("eth-sig-util");

const AccessControlSegregatorContract = artifacts.require(
  "AccessControlSegregator"
);
const BridgeContract = artifacts.require("Bridge");

const blankFunctionSig = "0x00000000";
const blankFunctionDepositorOffset = "0x0000";
const mpcAddress = "0x1Ad4b1efE3Bc6FEE085e995FCF48219430e615C3";
const mpcPrivateKey =
  "0x497b6ae580cb1b0238f8b6b543fada697bc6f8768a983281e5e52a1a5bca4d58";

const createResourceID = Helper.createResourceID;

const constructGenericHandlerSetResourceData = (...args) => {
  return args.reduce((accumulator, currentArg) => {
    if (typeof currentArg === "number") {
      currentArg = toHex(currentArg, 2);
    }
    return accumulator + currentArg.substr(2);
  });
};

const deployBridge = async (domainID, admin) => {
  const accessControlInstance = await AccessControlSegregatorContract.new(
    Helper.accessControlFuncSignatures,
    Array(13).fill(admin)
  );
  return await BridgeContract.new(domainID, accessControlInstance.address);
};

const expectToRevertWithCustomError = async function (promise, expectedErrorSignature) {
  try {
    await promise;
  } catch (error) {
    if (!error.data) {
      throw error;
    }
    const encoded = web3.eth.abi.encodeFunctionSignature(expectedErrorSignature);
    const returnValue = error.data.result || error.data;
    // expect event error and provided error signatures to match
    assert.equal(returnValue.slice(0, 10), encoded);

    let inputParams;
    // match everything between () in function signature
    const regex = RegExp(/\(([^)]+)\)/);
    if (regex.exec(expectedErrorSignature)) {
      const types = regex.exec(expectedErrorSignature)[1].split(",");
      inputParams = Ethers.utils.defaultAbiCoder.decode(
        types,
        Ethers.utils.hexDataSlice(returnValue, 4)
      );
    }
    return inputParams;
  }
  assert.fail("Expected a custom error but none was received");
}

const reverts = async function (promise, expectedErrorMessage) {
  try {
    await promise;
  } catch (error) {
    if (expectedErrorMessage) {
      const message = error.reason || error.hijackedStack.split("revert ")[1].split("\n")[0];
      assert.equal(message, expectedErrorMessage);
    }
    return true;
  }
  assert.fail("Expected an error message but none was received");
}

const toHex = (covertThis, padding) => {
  return Ethers.utils.hexZeroPad(Ethers.utils.hexlify(covertThis), padding);
};

const createERCWithdrawData = (
  tokenAddress,
  recipientAddress,
  tokenAmountOrID
) => {
  return (
    "0x" +
    toHex(tokenAddress, 32).substring(2) +
    toHex(recipientAddress, 32).substring(2) +
    toHex(tokenAmountOrID, 32).substring(2)
  );
};

const createERCDepositData = (
  tokenAmountOrID,
  lenRecipientAddress,
  recipientAddress
) => {
  return (
    "0x" +
    toHex(tokenAmountOrID, 32).substring(2) + // Token amount or ID to deposit (32 bytes)
    toHex(lenRecipientAddress, 32).substring(2) + // len(recipientAddress)          (32 bytes)
    recipientAddress.substring(2)
  ); // recipientAddress               (?? bytes)
};

const signTypedProposal = (bridgeAddress, proposals, chainId = 1) => {
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

  return ethSigUtil.signTypedMessage(Ethers.utils.arrayify(mpcPrivateKey), {
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

const passes = async function(promise) {
  try {
    await promise;
  } catch (error) {
    assert.fail("Revert reason: " + error.data.result);
  }
}

module.exports = {
  expectToRevertWithCustomError,
  deployBridge,
  constructGenericHandlerSetResourceData,
  signTypedProposal,
  createResourceID,
  createERCWithdrawData,
  createERCDepositData,
  reverts,
  passes,
  mpcPrivateKey,
  mpcAddress,
  blankFunctionDepositorOffset,
  blankFunctionSig
}