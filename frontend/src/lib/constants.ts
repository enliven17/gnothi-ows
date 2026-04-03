// Shared constants for the application
import { Abi } from 'viem';

// Contract addresses on Base Sepolia
// Real USDC on Base Sepolia (Circle's official deployment)
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
/** @deprecated use USDC_ADDRESS */
export const USDL_ADDRESS = USDC_ADDRESS;
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';

// Bridge service URL for automated resolution
export const BRIDGE_SERVICE_URL = process.env.NEXT_PUBLIC_BRIDGE_SERVICE_URL || 'http://localhost:3001';

// Standard ERC20 ABI (minimal - only functions we need)
export const ERC20_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address', internalType: 'address' },
            { name: 'spender', type: 'address', internalType: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    }
] as const satisfies Abi;

// USDC token configuration (6 decimals — same as USDL was)
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = 1_000_000; // 10^6 for 6 decimals
/** @deprecated use USDC_MULTIPLIER */
export const USDL_MULTIPLIER = USDC_MULTIPLIER;

// USDC ABI — standard ERC20 (no faucet/drip; use MoonPay to onramp)
export const USDC_ABI = ERC20_ABI;
/** @deprecated use USDC_ABI */
export const MOCK_USDL_ABI = USDC_ABI;

