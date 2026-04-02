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
import type { Conversation } from '@xmtp/browser-sdk';

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
  const groupRef = useRef<Conversation | null>(null);
  const xmtpInboxIdRef = useRef<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!walletAddress || !isConnected || !walletClient) return;
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

        xmtpInboxIdRef.current = xmtpClient.inboxId;

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
          setError('XMTP bağlantısı kurulamadı. Cüzdanınızı kontrol edin.');
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
  }, [walletAddress, isConnected, walletClient, marketId, marketTitle]);

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
  };
}
