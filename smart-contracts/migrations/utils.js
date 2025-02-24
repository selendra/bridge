const parseArgs = require("minimist");
const fs = require("fs");
const Helpers = require("../helpers");
const Ethers = require("ethers");

const ERC20PresetMinterPauser = artifacts.require("ERC20PresetMinterPauserDecimals");
const DEFAULT_CONFIG_PATH = "./migrations/config/local.json";
const erc20TokenAmount = Ethers.utils.parseUnits("1000", 18);

const accessControlFuncSignatures = Helpers.accessControlFuncSignatures;

function getNetworksConfig() {
  let path = parseArgs(process.argv.slice(2))["file"];
  if (path == undefined) {
    path = DEFAULT_CONFIG_PATH;
  }

  return JSON.parse(fs.readFileSync(path));
}

async function getDeployerAddress(deployer) {
  return await deployer["networks"][deployer["network"]][
    "from"
  ];
}

async function setupErc20(
  deployer,
  erc20,
  bridgeInstance,
  erc20HandlerInstance,
  domainID
) {
  let erc20Instance;
  if (!erc20.address) {
    erc20Instance = await deployer.deploy(
      ERC20PresetMinterPauser,
      erc20.name,
      erc20.symbol,
      erc20.decimals
    );
    erc20.address = erc20Instance.address;
  } else {
    erc20Instance = await ERC20PresetMinterPauser.at(erc20.address);
    erc20Instance.contract.setProvider(deployer.provider);
  }

  console.log(`here resourceID ${erc20.address}`);
  const resourceID = Helpers.createResourceID(erc20.address, domainID);
  erc20.resourceID = resourceID;
  console.log("End resourceID");

  await bridgeInstance.adminSetResource(
    erc20HandlerInstance.address,
    erc20.resourceID,
    erc20Instance.address,
    Ethers.utils.hexlify(Number(erc20.decimals))
  );

  // strategy can be either mb (mint/burn) or lr (lock/release)
  if (erc20.strategy == "mb") {
    await erc20Instance.grantRole(
      await erc20Instance.MINTER_ROLE(),
      erc20HandlerInstance.address
    );
    await bridgeInstance.adminSetBurnable(
      erc20HandlerInstance.address,
      erc20Instance.address
    );
  }

  await erc20Instance.mint(
    await getDeployerAddress(deployer),
    erc20TokenAmount
  );
  await erc20Instance.mint(
    erc20HandlerInstance.address,
    erc20TokenAmount
  );
}


module.exports = {
  accessControlFuncSignatures,
  getNetworksConfig,
  getDeployerAddress,
  setupErc20,
}