const Utils = require("./utils");

const AccessControlSegregatorContract = artifacts.require(
  "AccessControlSegregator"
);
const PausableContract = artifacts.require("Pausable");
const BridgeContract = artifacts.require("Bridge");
const DefaultMessageReceiverContract = artifacts.require("DefaultMessageReceiver");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

const FeeRouterContract = artifacts.require("FeeHandlerRouter");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");
const PercentageFeeHandler = artifacts.require("PercentageERC20FeeHandler");

module.exports = async function (deployer, network) {
  const networksConfig = Utils.getNetworksConfig();
  // fetch deployer address
  const deployerAddress = await Utils.getDeployerAddress(deployer);
  // assign addresses for access segregation
  const functionAccessAddresses = Array(13).fill(deployerAddress);

  const accessControlSegregatorInstance = await deployer.deploy(
    AccessControlSegregatorContract,
    Utils.accessControlFuncSignatures,
    functionAccessAddresses
  );
  await deployer.deploy(PausableContract);

  // deploy main contracts
  const bridgeInstance = await deployer.deploy(
    BridgeContract,
    networksConfig.domainID,
    accessControlSegregatorInstance.address
  );

  // deploy handler contracts
  const defaultMessageReceiverInstance = await deployer.deploy(
    DefaultMessageReceiverContract,
    [],
    100000
  );
  const erc20HandlerInstance = await deployer.deploy(
    ERC20HandlerContract,
    bridgeInstance.address,
    defaultMessageReceiverInstance.address
  );

  // deploy fee handlers
  const feeRouterInstance = await deployer.deploy(
    FeeRouterContract,
    bridgeInstance.address
  );
  const basicFeeHandlerInstance = await deployer.deploy(
    BasicFeeHandlerContract,
    bridgeInstance.address,
    feeRouterInstance.address
  );
  const percentageFeeHandlerInstance = await deployer.deploy(
    PercentageFeeHandler,
    bridgeInstance.address,
    feeRouterInstance.address
  )

  // setup fee router
  await bridgeInstance.adminChangeFeeHandler(feeRouterInstance.address);

  await defaultMessageReceiverInstance.grantRole(
    await defaultMessageReceiverInstance.SYGMA_HANDLER_ROLE(),
    erc20HandlerInstance.address
  );

  console.table({
    "Deployer Address": deployerAddress,
    "Domain ID": networksConfig.domainID,
    "Bridge Address": bridgeInstance.address,
    "DefaultMessageReceiver Address": defaultMessageReceiverInstance.address,
    "ERC20Handler Address": erc20HandlerInstance.address,
    "FeeRouterContract Address": feeRouterInstance.address,
    "BasicFeeHandler Address": basicFeeHandlerInstance.address,
    "PercentageFeeHandler Address": percentageFeeHandlerInstance.address
  });

  // setup erc20 tokens
  for (const erc20 of networksConfig.erc20) {
    await Utils.setupErc20(
      deployer,
      erc20,
      bridgeInstance,
      erc20HandlerInstance,
      networksConfig.domainID,
    );

    console.log(
      "-------------------------------------------------------------------------------"
    );
    console.log("ERC20 address:", "\t", erc20.address);
    console.log("ResourceID:", "\t", erc20.resourceID);
    console.log("Decimal places:", "\t", erc20.decimals);
    console.log(
      "-------------------------------------------------------------------------------"
    );
  }

  // set MPC address
  if (networksConfig.MPCAddress)
    await bridgeInstance.endKeygen(networksConfig.MPCAddress);

  console.log("🎉🎉🎉 Sygma bridge successfully configured 🎉🎉🎉", "\n");
}