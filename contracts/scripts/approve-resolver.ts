import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  const bridgeWallet = process.env.RESOLVER_ADDRESS!;

  const factory = await ethers.getContractAt("BetFactoryCOFI", factoryAddress);
  const owner = await factory.owner();

  console.log("Signer:        ", signer.address);
  console.log("Factory owner: ", owner);
  console.log("Bridge wallet: ", bridgeWallet);

  // 1. Approve as creator (can create bets)
  const alreadyCreator = await factory.approvedCreators(bridgeWallet).catch(() => false);
  if (alreadyCreator) {
    console.log("Already approved as creator.");
  } else {
    const tx1 = await factory.setCreatorApproval(bridgeWallet, true);
    console.log("setCreatorApproval TX:", tx1.hash);
    await tx1.wait();
    console.log("✓ Bridge wallet approved as creator");
  }

  // 2. Approve as resolver (can call resolve())
  const alreadyResolver = await factory.approvedResolvers(bridgeWallet);
  if (alreadyResolver) {
    console.log("Already approved as resolver.");
  } else {
    const tx2 = await factory.setResolverApproval(bridgeWallet, true);
    console.log("setResolverApproval TX:", tx2.hash);
    await tx2.wait();
    console.log("✓ Bridge wallet approved as resolver");
  }

  console.log("\nDone — bridge wallet can now create and resolve all markets.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
