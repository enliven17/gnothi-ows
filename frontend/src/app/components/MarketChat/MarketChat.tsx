'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMarketChat, type ChatMessage } from '../../../lib/xmtp/useMarketChat';
import { useWallet } from '../../providers/WalletProvider';
import { openMoonPayOnramp, isMoonPayConfigured } from '../../../lib/moonpay/onramp';
import styles from './MarketChat.module.css';

interface MarketChatProps {
  marketId: string;
  marketTitle: string;
}

function shortId(inboxId: string): string {
  if (!inboxId) return '?';
  return inboxId.slice(0, 6) + '…';
}

function isBot(inboxId: string): boolean {
  return inboxId === 'bot' || inboxId.startsWith('marketbot');
}

export default function MarketChat({ marketId, marketTitle }: MarketChatProps) {
  const { isConnected: walletConnected, walletAddress, connect } = useWallet();
  const { messages, send, isInitializing, isConnected: chatConnected, error } = useMarketChat(
    marketId,
    marketTitle
  );

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showOnramp, setShowOnramp] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !chatConnected) return;
    setInput('');
    setSending(true);
    try {
      await send(text);
    } catch (err) {
      console.error('[MarketChat] send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOnramp = () => {
    if (!walletAddress) return;
    openMoonPayOnramp({
      walletAddress,
      baseCurrencyAmount: 50,
      onSuccess: () => setShowOnramp(false),
    });
  };

  if (!walletConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>💬</span>
          <span className={styles.headerTitle}>Market Chat</span>
          <span className={styles.badge}>XMTP</span>
        </div>
        <div className={styles.gate}>
          <p>Connect your wallet to join the market conversation.</p>
          <button className={styles.connectBtn} onClick={connect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>💬</span>
          <span className={styles.headerTitle}>Market Chat</span>
          <span className={styles.badge}>XMTP</span>
        </div>
        <div className={styles.gate}>
          <div className={styles.spinner} />
          <p>Connecting to XMTP…</p>
          <p className={styles.hint}>You may be asked to sign a message in your wallet.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>💬</span>
          <span className={styles.headerTitle}>Market Chat</span>
        </div>
        <div className={styles.gate}>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>💬</span>
        <span className={styles.headerTitle}>Market Chat</span>
        <span className={styles.badge}>XMTP</span>
        {isMoonPayConfigured() && (
          <button className={styles.onrampBtn} onClick={handleOnramp} title="Buy USDC with fiat">
            💳 Buy USDC
          </button>
        )}
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            No messages yet. Be the first to share your prediction!
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="Share your prediction…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending || !chatConnected}
          maxLength={500}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={sending || !input.trim() || !chatConnected}
        >
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const bot = isBot(message.senderInboxId);

  return (
    <div
      className={[
        styles.bubble,
        message.isOwn ? styles.bubbleOwn : styles.bubbleOther,
        bot ? styles.bubbleBot : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!message.isOwn && (
        <span className={styles.sender}>
          {bot ? '🤖 MarketBot' : shortId(message.senderInboxId)}
        </span>
      )}
      <p className={styles.content}>{message.content}</p>
      <span className={styles.time}>
        {message.sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
