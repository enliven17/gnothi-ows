'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useWallet } from '../../providers/WalletProvider';
import { useToast } from '../../providers/ToastProvider';
import styles from './GroupMarketPanel.module.css';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS ?? '') as `0x${string}`;

const GROUP_MARKET_ABI = [
  { name: 'groupName',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'fundingGoal',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDeposited',type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'betExecuted',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'resolved',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'getMemberCount',type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deposits',      type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'deposit',       type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'executeBet',    type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'receivePayout', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'claimShare',    type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

interface GroupMarketPanelProps {
  groupMarketAddress: `0x${string}`;
}

interface GroupState {
  name: string;
  goal: bigint;
  deposited: bigint;
  betExecuted: boolean;
  resolved: boolean;
  memberCount: bigint;
  myDeposit: bigint;
}

export default function GroupMarketPanel({ groupMarketAddress }: GroupMarketPanelProps) {
  const { walletAddress, isConnected } = useWallet();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { showToast } = useToast();

  const [state, setState] = useState<GroupState | null>(null);
  const [depositAmount, setDepositAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);

  const load = useCallback(async () => {
    if (!publicClient || !walletAddress) return;
    setLoading(true);
    try {
      const [name, goal, deposited, betDone, res, count, myDep] = await Promise.all([
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'groupName' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'fundingGoal' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'totalDeposited' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'betExecuted' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'resolved' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'getMemberCount' }),
        publicClient.readContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'deposits', args: [walletAddress as `0x${string}`] }),
      ]);
      setState({ name: name as string, goal: goal as bigint, deposited: deposited as bigint, betExecuted: betDone as boolean, resolved: res as boolean, memberCount: count as bigint, myDeposit: myDep as bigint });
    } catch (e) {
      console.error('[GroupMarket] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletAddress, groupMarketAddress]);

  useEffect(() => { load(); }, [load]);

  const handleDeposit = async () => {
    if (!walletClient || !walletAddress || !publicClient) return;
    const amount = parseUnits(depositAmount, 6);
    setTxPending(true);
    try {
      // 1. Approve USDC
      const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [walletAddress as `0x${string}`, groupMarketAddress] });
      if ((allowance as bigint) < amount) {
        const approveTx = await walletClient.writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [groupMarketAddress, amount] });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }
      // 2. Deposit
      const tx = await walletClient.writeContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'deposit', args: [amount] });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      showToast(`Deposited ${depositAmount} USDC to group!`, 'success');
      await load();
    } catch (e: any) {
      showToast(e?.shortMessage ?? 'Deposit failed', 'error');
    } finally {
      setTxPending(false);
    }
  };

  const handleExecuteBet = async () => {
    if (!walletClient || !publicClient) return;
    setTxPending(true);
    try {
      const tx = await walletClient.writeContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'executeBet' });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      showToast('Group bet placed!', 'success');
      await load();
    } catch (e: any) {
      showToast(e?.shortMessage ?? 'Execute failed', 'error');
    } finally {
      setTxPending(false);
    }
  };

  const handleClaim = async () => {
    if (!walletClient || !publicClient) return;
    setTxPending(true);
    try {
      const tx = await walletClient.writeContract({ address: groupMarketAddress, abi: GROUP_MARKET_ABI, functionName: 'claimShare' });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      showToast('Payout claimed!', 'success');
      await load();
    } catch (e: any) {
      showToast(e?.shortMessage ?? 'Claim failed', 'error');
    } finally {
      setTxPending(false);
    }
  };

  if (!isConnected) return null;
  if (loading || !state) return <div className={styles.loading}>Loading group…</div>;

  const progress = state.goal > 0n ? Number((state.deposited * 100n) / state.goal) : 0;
  const goalFmt = formatUnits(state.goal, 6);
  const depositedFmt = formatUnits(state.deposited, 6);
  const myDepFmt = formatUnits(state.myDeposit, 6);
  const funded = state.deposited >= state.goal;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.badge}>GROUP</span>
        <span className={styles.name}>{state.name}</span>
        <span className={styles.members}>{String(state.memberCount)} members</span>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar} style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <div className={styles.progressLabel}>
        <span>{depositedFmt} USDC</span>
        <span>Goal: {goalFmt} USDC</span>
      </div>

      {Number(myDepFmt) > 0 && (
        <div className={styles.myShare}>Your deposit: {myDepFmt} USDC</div>
      )}

      {!state.betExecuted && (
        <div className={styles.depositRow}>
          <input
            className={styles.input}
            type="number"
            min="1"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            disabled={txPending}
          />
          <span className={styles.unit}>USDC</span>
          <button className={styles.btn} onClick={handleDeposit} disabled={txPending}>
            {txPending ? '…' : 'Deposit'}
          </button>
        </div>
      )}

      {!state.betExecuted && funded && (
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleExecuteBet} disabled={txPending}>
          {txPending ? 'Placing bet…' : '🎯 Place Group Bet'}
        </button>
      )}

      {state.resolved && state.myDeposit > 0n && (
        <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleClaim} disabled={txPending}>
          {txPending ? 'Claiming…' : '💰 Claim My Share'}
        </button>
      )}

      {state.betExecuted && !state.resolved && (
        <div className={styles.status}>⏳ Bet placed — waiting for market resolution…</div>
      )}
    </div>
  );
}
