const parseArgs = require("minimist");
const fs = require("fs");
const Helpers = require("./helpers/generateFuncSignatures");

const DEFAULT_CONFIG_PATH = "./migrations/local.json";
const accessControlFuncSignatures = Helpers.generateAccessControlFuncSignatures().map(e => e.hash);

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


module.exports = {
    accessControlFuncSignatures,
    getNetworksConfig,
    getDeployerAddress,
}