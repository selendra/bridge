const Utils = require("./utils");

// // setup erc20 tokens
// for (const erc20 of currentNetworkConfig.erc20) {
//     await Utils.setupErc20(
//       deployer,
//       erc20,
//       bridgeInstance,
//       erc20HandlerInstance
//     );

//     console.log(
//       "-------------------------------------------------------------------------------"
//     );
//     console.log("ERC20 address:", "\t", erc20.address);
//     console.log("ResourceID:", "\t", erc20.resourceID);
//     console.log("Decimal places:", "\t", erc20.decimals);
//     console.log(
//       "-------------------------------------------------------------------------------"
//     );
// }

module.exports = async function (deployer, network) {
    const networksConfig = Utils.getNetworksConfig();
}