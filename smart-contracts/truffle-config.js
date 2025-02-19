const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  plugins: ["solidity-coverage", "truffle-plugin-verify"],
  networks: {
    networkCheckTimeout: 10000,
    holesky: {
      provider: () => {
        return new HDWalletProvider({
          mnemonic: process.env.PRIVATE_KEY,
          providerOrUrl: process.env.HOLESKY_PROVIDER_URL
        })
      },
      networkCheckTimeout: 10000,
      timeoutBlocks: 200,
      network_id: "17000",
      gasPrice: 30000000000,  // 30 gwei
    },
    sepolia: {
      provider: () => {
        return new HDWalletProvider({
          mnemonic: process.env.PRIVATE_KEY,
          providerOrUrl: process.env.SEPOLIA_PROVIDER_URL
        })
      },
      networkCheckTimeout: 10000,
      timeoutBlocks: 200,
      network_id: "5",
      gasPrice: 30000000000,  // 30 gwei
    },
  },

  mocha: {
    // timeout: 100000
  },
  compilers: {
    solc: {
      version: "0.8.11",       // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "london"
      }
    }
  }
}