import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.5.3",
    settings: {},
  },
  solidity: {
    version: "0.8.22",
  },
  networks: {
    zkSyncSepoliaTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      accounts: [process.env.PRIVATE_KEY!],
      zksync: true,
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification',
    },
  },
};

export default config;
