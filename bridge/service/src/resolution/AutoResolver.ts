/**
 * Auto Resolver - Contract Interaction Module
 *
 * Handles automated calling of BetCOFI.resolve() method using the bridge service wallet.
 * Resolution is allowed for the market creator, the factory owner, or any resolver
 * address explicitly approved by the factory owner.
 */

import { ethers } from "ethers";
import { getBaseSepoliaRpcUrl, getPrivateKey } from "../config.js";
import { createOWSSigningWallet } from "../ows/OWSVault.js";

// Minimal ABI for BetCOFI.resolve() function
const BET_COFI_ABI = [
  {
    type: 'function',
    name: 'resolve',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    type: 'function',
    name: 'factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'creator',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'endDate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'status',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }]
  },
  {
    type: 'function',
    name: 'title',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }]
  }
] as const;

const BET_FACTORY_ABI = [
  {
    type: 'function',
    name: 'canResolveBet',
    stateMutability: 'view',
    inputs: [
      { name: 'caller', type: 'address', internalType: 'address' },
      { name: 'creator', type: 'address', internalType: 'address' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
  }
] as const;

// BetStatus enum from contract
enum BetStatus {
  ACTIVE = 0,
  RESOLVING = 1,
  RESOLVED = 2,
  UNDETERMINED = 3
}

export class AutoResolver {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Signer;
  private walletAddress: string;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.wallet = createOWSSigningWallet(getPrivateKey(), this.provider);
    // address resolved async; walletAddress set synchronously via fallback
    this.walletAddress = (this.wallet as any).address ?? '';

  }

  /**
   * Resolve a market by calling BetCOFI.resolve()
   */
  public async resolveMarket(contractAddress: string, marketTitle: string): Promise<void> {
    try {
      // Create contract instance
      const betContract = new ethers.Contract(contractAddress, BET_COFI_ABI, this.wallet);

      // Pre-flight checks
      await this.validateResolutionConditions(betContract, contractAddress, marketTitle);

      // Estimate gas for the transaction
      const gasEstimate = await betContract.resolve.estimateGas();
      const gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      // Call resolve() method
      const tx = await betContract.resolve({
        gasLimit,
        gasPrice: gasPrice || undefined, // Let ethers handle if null
      });

      // Wait for confirmation
      const receipt = await tx.wait(2); // Wait for 2 confirmations

      if (receipt && receipt.status === 1) {
        console.log(`[AutoResolver] TX sent: ${tx.hash}`);
      } else {
        throw new Error(`Transaction failed: status ${receipt?.status}`);
      }

    } catch (error: any) {
      // Provide helpful error context
      if (error.code === 'CALL_EXCEPTION') {
        console.error(`[AutoResolver] Contract revert - likely not creator or already resolved`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        console.error(`[AutoResolver] Insufficient funds: ${this.walletAddress}`);
      } else {
        console.error(`[AutoResolver] Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate conditions before attempting resolution
   */
  private async validateResolutionConditions(
    betContract: ethers.Contract,
    contractAddress: string,
    marketTitle: string
  ): Promise<void> {

    try {
      // Check resolver authorization via factory policy
      const creator = await betContract.creator();
      const factoryAddress = await betContract.factory();
      const factoryContract = new ethers.Contract(factoryAddress, BET_FACTORY_ABI, this.provider);
      const canResolve = await factoryContract.canResolveBet(this.walletAddress, creator);
      if (!canResolve) {
        throw new Error(
          `Not authorized to resolve this market. Creator: ${creator}, Resolver: ${this.walletAddress}`
        );
      }

      // Check end date (must be in the past)
      const endDateBigInt = await betContract.endDate();
      const endDate = new Date(Number(endDateBigInt) * 1000);
      const now = new Date();

      if (now < endDate) {
        throw new Error(
          `Market has not ended yet. End date: ${endDate.toISOString()}, Current: ${now.toISOString()}`
        );
      }

      // Check status (must be ACTIVE)
      const status = await betContract.status();
      if (Number(status) !== BetStatus.ACTIVE) {
        const statusName = BetStatus[Number(status)] || 'UNKNOWN';
        throw new Error(
          `Market is not in ACTIVE state. Current status: ${statusName} (${status})`
        );
      }

      // Check wallet balance (should have enough for gas)
      const balance = await this.provider.getBalance(this.walletAddress);
      const minBalance = ethers.parseEther("0.001"); // 0.001 ETH minimum

      if (balance < minBalance) {
        console.warn(`[AutoResolver] Low wallet balance: ${ethers.formatEther(balance)} ETH`);
      }


    } catch (error) {
      console.error(`[AutoResolver] Validation failed for ${contractAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get market info for debugging
   */
  public async getMarketInfo(contractAddress: string): Promise<{
    title: string;
    creator: string;
    endDate: Date;
    status: string;
    canResolve: boolean;
  }> {
    try {
      const betContract = new ethers.Contract(contractAddress, BET_COFI_ABI, this.provider);

      const [title, creator, endDateBigInt, status] = await Promise.all([
        betContract.title(),
        betContract.creator(),
        betContract.endDate(),
        betContract.status()
      ]);
      const factoryAddress = await betContract.factory();
      const factoryContract = new ethers.Contract(factoryAddress, BET_FACTORY_ABI, this.provider);
      const canResolve = await factoryContract.canResolveBet(this.walletAddress, creator);

      const endDate = new Date(Number(endDateBigInt) * 1000);
      const now = new Date();
      const statusName = BetStatus[Number(status)] || 'UNKNOWN';

      const canResolveNow =
        canResolve &&
        now >= endDate &&
        Number(status) === BetStatus.ACTIVE;

      return {
        title,
        creator,
        endDate,
        status: statusName,
        canResolve: canResolveNow
      };

    } catch (error) {
      console.error(`[AutoResolver] Failed to get market info for ${contractAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get the resolver wallet address
   */
  public getWalletAddress(): string {
    return this.walletAddress;
  }
}
