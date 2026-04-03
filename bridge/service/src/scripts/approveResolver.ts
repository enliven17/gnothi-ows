/**
 * approveResolver.ts
 *
 * Run this ONCE from the factory owner wallet to authorize the bridge service
 * wallet as an approved resolver.
 *
 * Usage:
 *   OWNER_PRIVATE_KEY=<factory_owner_pk> npx tsx src/scripts/approveResolver.ts
 *
 * The factory owner is whoever deployed BetFactoryCOFI (the PRIVATE_KEY used
 * in `npx hardhat deploy`).  If you used a different key to deploy, set
 * OWNER_PRIVATE_KEY to that key.
 *
 * After running this, the bridge service wallet will pass canResolveBet() for
 * ALL markets — regardless of who created them.
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'setResolverApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_resolver', type: 'address', internalType: 'address' },
      { name: '_approved', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approvedResolvers',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
  },
] as const;

async function main() {
  const ownerPk = process.env.OWNER_PRIVATE_KEY;
  const bridgePk = process.env.PRIVATE_KEY;
  const factoryAddress = process.env.BET_FACTORY_ADDRESS;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;

  if (!ownerPk) {
    console.error('❌  OWNER_PRIVATE_KEY is not set.');
    console.error('   Set it to the private key of whoever deployed BetFactoryCOFI.');
    process.exit(1);
  }
  if (!bridgePk) {
    console.error('❌  PRIVATE_KEY (bridge wallet) is not set in .env');
    process.exit(1);
  }
  if (!factoryAddress) {
    console.error('❌  BET_FACTORY_ADDRESS is not set in .env');
    process.exit(1);
  }
  if (!rpcUrl) {
    console.error('❌  BASE_SEPOLIA_RPC_URL is not set in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const ownerWallet = new ethers.Wallet(ownerPk, provider);
  const bridgeWallet = new ethers.Wallet(bridgePk, provider);
  const resolverAddress = bridgeWallet.address;

  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, ownerWallet);

  const factoryOwner: string = await factory.owner();
  console.log(`Factory owner   : ${factoryOwner}`);
  console.log(`Signing wallet  : ${ownerWallet.address}`);
  console.log(`Resolver to add : ${resolverAddress}`);

  if (ownerWallet.address.toLowerCase() !== factoryOwner.toLowerCase()) {
    console.error('❌  OWNER_PRIVATE_KEY does not match the factory owner address.');
    console.error(`   Expected: ${factoryOwner}`);
    console.error(`   Got:      ${ownerWallet.address}`);
    process.exit(1);
  }

  const alreadyApproved: boolean = await factory.approvedResolvers(resolverAddress);
  if (alreadyApproved) {
    console.log(`✅  ${resolverAddress} is already an approved resolver. Nothing to do.`);
    process.exit(0);
  }

  console.log(`\nCalling setResolverApproval(${resolverAddress}, true)…`);
  const tx = await factory.setResolverApproval(resolverAddress, true);
  console.log(`TX sent: ${tx.hash}`);
  const receipt = await tx.wait(2);
  if (receipt?.status === 1) {
    console.log(`✅  Done! Bridge wallet ${resolverAddress} is now an approved resolver.`);
  } else {
    console.error('❌  Transaction failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
