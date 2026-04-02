import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync";
import "dotenv/config";

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.5.0", // Confirm this version exists and is stable
    settings: {},
  },
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,  // Enable IR-based compiler to avoid "stack too deep" errors
    },
  },
  networks: {
    // Base Sepolia Testnet
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
    // zkSync Sepolia Testnet
    zkSyncSepoliaTestnet: {
      url: process.env.ZKSYNC_SEPOLIA_RPC_URL || "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia", // or a Sepolia RPC URL
      zksync: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      zkSyncSepoliaTestnet: "123", // Placeholder for zkSync
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "zkSyncSepoliaTestnet",
        chainId: 300,
        urls: {
          apiURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
          browserURL: "https://sepolia.explorer.zksync.io/",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;

