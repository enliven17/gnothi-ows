'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../app/providers/WalletProvider';
import { useWalletClient } from 'wagmi';
import { getXmtpClient } from './client';
import {
  getOrCreateMarketGroup,
  sendMarketMessage,
  loadMarketMessages,
  streamMarketMessages,
} from './marketChat';
import type { Group } from '@xmtp/browser-sdk';

export interface ChatMessage {
  id: string;
  senderInboxId: string;
  content: string;
  sentAt: Date;
  isOwn: boolean;
}

export interface UseMarketChatResult {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  isInitializing: boolean;
  isConnected: boolean;
  error: string | null;
  join: () => void;
  hasJoined: boolean;
}

export function useMarketChat(
  marketId: string,
  marketTitle: string
): UseMarketChatResult {
  const { walletAddress, isConnected } = useWallet();
  const { data: walletClient } = useWalletClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinCount, setJoinCount] = useState(0);
  const groupRef = useRef<Group | null>(null);
  const xmtpInboxIdRef = useRef<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const hasJoined = joinCount > 0;

  const join = useCallback(() => {
    setError(null);
    groupRef.current = null;
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    setMessages([]);
    setJoinCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!walletAddress || !isConnected || !walletClient || joinCount === 0) return;
    let cancelled = false;

    const init = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        const signMessage = async (message: string) => {
          const sig = await walletClient.signMessage({ message });
          return sig;
        };

        const xmtpClient = await getXmtpClient(
          walletAddress as `0x${string}`,
          signMessage
        );
        if (cancelled) return;

        xmtpInboxIdRef.current = xmtpClient.inboxId ?? null;

        const group = await getOrCreateMarketGroup(
          xmtpClient,
          marketId,
          marketTitle
        );
        if (cancelled) return;

        groupRef.current = group;

        // Load history
        const history = await loadMarketMessages(group, 50);
        if (cancelled) return;

        setMessages(
          history.map((m, i) => ({
            id: `hist-${i}`,
            ...m,
            isOwn: m.senderInboxId === xmtpClient.inboxId,
          }))
        );

        // Stream new messages
        const stop = streamMarketMessages(group, (m) => {
          if (cancelled) return;
          setMessages((prev) => [
            ...prev,
            {
              id: `live-${Date.now()}-${Math.random()}`,
              ...m,
              isOwn: m.senderInboxId === xmtpClient.inboxId,
            },
          ]);
        });
        stopStreamRef.current = stop;
      } catch (err) {
        if (!cancelled) {
          console.error('[useMarketChat] init error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          setError(`XMTP bağlantısı kurulamadı: ${msg}`);
        }
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      stopStreamRef.current?.();
      stopStreamRef.current = null;
    };
  }, [walletAddress, isConnected, walletClient, marketId, marketTitle, joinCount]);

  const send = useCallback(async (text: string) => {
    if (!groupRef.current) throw new Error('Chat not initialized');
    await sendMarketMessage(groupRef.current, text);
  }, []);

  return {
    messages,
    send,
    isInitializing,
    isConnected: !!groupRef.current,
    error,
    join,
    hasJoined,
  };
}
