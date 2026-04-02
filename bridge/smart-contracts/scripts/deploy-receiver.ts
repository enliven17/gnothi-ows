import {
  getNetworkInfo,
  logNetworkHeader,
  saveDeploymentResult,
  verifyContract,
  getEnvVar,
  validateAddress,
} from "./utils";
import { ethers } from "hardhat";

async function deployBridgeReceiver() {
  const networkInfo = await getNetworkInfo();
  logNetworkHeader("Deploying BridgeReceiver", networkInfo);

  // Validate config
  validateAddress(networkInfo.endpointAddress, "LZ Endpoint");
  const ownerAddress = getEnvVar("OWNER_ADDRESS");
  validateAddress(ownerAddress, "Owner");

  console.log("\nConfiguration:");
  console.log("  Endpoint:", networkInfo.endpointAddress);
  console.log("  Owner:", ownerAddress);

  // Deploy
  const BridgeReceiver = await ethers.getContractFactory("BridgeReceiver");
  const contract = await BridgeReceiver.deploy(
    networkInfo.endpointAddress,
    ownerAddress
  );

  const deployTx = contract.deploymentTransaction();
  if (!deployTx) throw new Error("Deployment transaction not found");

  console.log("\nDeploying... TX:", deployTx.hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  // Save & verify
  await saveDeploymentResult({
    contract: "BridgeReceiver",
    network: networkInfo.networkName,
    chainId: Number(networkInfo.chainId),
    address,
    deploymentHash: deployTx.hash,
    params: {
      endpoint: networkInfo.endpointAddress,
      owner: ownerAddress,
    },
    timestamp: new Date().toISOString(),
  });

  await verifyContract(address, [
    networkInfo.endpointAddress,
    ownerAddress,
  ]);

  console.log("\n✓ BridgeReceiver deployed to:", address);
  return address;
}

async function main() {
  await deployBridgeReceiver();
}

main().catch((error) => {
  console.error("\nDeployment failed!");
  console.error(error);
  process.exitCode = 1;
});
