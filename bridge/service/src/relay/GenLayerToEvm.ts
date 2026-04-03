/**
 * GenLayer -> EVM Relay
 *
 * Polls GenLayer BridgeSender for pending messages and relays them
 * via zkSync BridgeForwarder to destination EVM chains.
 */

import { ethers } from "ethers";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Address } from "genlayer-js/types";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { notifyResolved } from "../xmtp/marketBot.js";
import {
  getBridgeForwarderAddress,
  getBridgeSenderAddress,
  getForwarderNetworkRpcUrl,
  getGenlayerRpcUrl,
  getPrivateKey,
} from "../config.js";
import { createOWSSigningWallet, OWS_RELAY_WALLET } from "../ows/OWSVault.js";
import { getCallerPrivateKey } from "../config.js";

interface BridgeMessage {
  targetChainId: number;
  targetContract: string;
  data: string;
}

const BRIDGE_FORWARDER_ABI = [
  "function callRemoteArbitrary(bytes32 txHash, uint32 dstEid, bytes data, bytes options) external payable",
  "function quoteCallRemoteArbitrary(uint32 dstEid, bytes data, bytes options) external view returns (uint256 nativeFee, uint256 lzTokenFee)",
  "function isHashUsed(bytes32 txHash) external view returns (bool)",
  "function endpoint() external view returns (address)",
  "function CALLER_ROLE() external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
];

export class GenLayerToEvmRelay {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Signer;
  private bridgeForwarder: ethers.Contract;
  private genLayerClient: any;
  private usedHashes: Set<string>;
  private initialized: boolean;
  private forwarderChecked: boolean;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(getForwarderNetworkRpcUrl());
    this.wallet = createOWSSigningWallet(OWS_RELAY_WALLET, getCallerPrivateKey(), this.provider);

    this.bridgeForwarder = new ethers.Contract(
      getBridgeForwarderAddress(),
      BRIDGE_FORWARDER_ABI,
      this.wallet
    );

    // Initialize GenLayer client
    const privateKey = getPrivateKey();
    const account = createAccount(`0x${privateKey.replace(/^0x/, "")}`);
    this.genLayerClient = createClient({
      chain: {
        ...studionet,
        rpcUrls: {
          default: { http: [getGenlayerRpcUrl()] },
        },
      },
      account,
    });

    this.usedHashes = new Set<string>();
    this.initialized = false;
    this.forwarderChecked = false;
  }

  private async ensureForwarderReady(): Promise<boolean> {
    if (this.forwarderChecked) {
      return true;
    }

    const forwarderAddress = String(this.bridgeForwarder.target);
    const code = await this.provider.getCode(forwarderAddress);
    if (code === "0x") {
      console.error(`[GL->EVM] FATAL: No contract deployed at BRIDGE_FORWARDER_ADDRESS ${forwarderAddress}`);
      console.error("          Update bridge/service/.env and bridge/smart-contracts/.env to the deployed BridgeForwarder address.");
      return false;
    }

    try {
      const endpointAddress = await this.bridgeForwarder.endpoint();
      const endpointCode = await this.provider.getCode(endpointAddress);
      if (endpointCode === "0x") {
        console.error(`[GL->EVM] FATAL: BridgeForwarder ${forwarderAddress} points to an endpoint with no code: ${endpointAddress}`);
        console.error("          Re-deploy BridgeForwarder with the correct LayerZero endpoint for zkSync Sepolia.");
        return false;
      }
    } catch (endpointErr: any) {
      console.error(`[GL->EVM] FATAL: Could not verify BridgeForwarder endpoint: ${endpointErr.message}`);
      return false;
    }

    try {
      const callerRole = await this.bridgeForwarder.CALLER_ROLE();
      const walletAddr = await this.wallet.getAddress();
      const hasCallerRole = await this.bridgeForwarder.hasRole(callerRole, walletAddr);
      if (!hasCallerRole) {
        console.error(`[GL->EVM] FATAL: Relay wallet ${walletAddr} does not have CALLER_ROLE on ${forwarderAddress}`);
        console.error("          Grant CALLER_ROLE with bridge/smart-contracts/scripts/set-caller.ts or switch PRIVATE_KEY to the authorized relay wallet.");
        return false;
      }
    } catch (roleErr: any) {
      console.warn(`[GL->EVM] Warning: Could not verify CALLER_ROLE on ${forwarderAddress}: ${roleErr.message}`);
    }

    this.forwarderChecked = true;
    return true;
  }

  private async getPendingMessages(): Promise<string[]> {
    try {
      const response = await this.genLayerClient.readContract({
        address: getBridgeSenderAddress() as Address,
        functionName: "get_message_hashes",
        args: [],
        stateStatus: "accepted",
      });

      if (!Array.isArray(response)) {
        console.error("Unexpected response format:", response);
        return [];
      }

      return response.filter(
        (hash): hash is string => !this.usedHashes.has(hash)
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }

  private async relayMessage(hash: string): Promise<void> {
    try {
      console.log(`[GL→EVM] Processing message ${hash}`);

      // Check if already relayed
      let isUsed = false;
      try {
        isUsed = await this.bridgeForwarder.isHashUsed(`0x${hash}`);
      } catch (err: any) {
        console.warn(`[GL→EVM] Warning: Could not check relay status for ${hash}. Proceeding with relay attempt anyway.`);
        // Do NOT return — fall through and attempt relay.
        // The contract will reject duplicate hashes on-chain.
        isUsed = false;
      }
      
      if (isUsed) {
        console.log(`[GL→EVM] Message ${hash} already relayed, skipping`);
        this.usedHashes.add(hash);
        return;
      }

      // Get message from GenLayer
      const messageResponse: Map<string, any> =
        await this.genLayerClient.readContract({
          address: getBridgeSenderAddress() as Address,
          functionName: "get_message",
          args: [hash],
          stateStatus: "accepted",
        });

      // Convert data to hex
      let messageData = messageResponse.get("data");
      if (messageData instanceof Uint8Array || Buffer.isBuffer(messageData)) {
        messageData = "0x" + Buffer.from(messageData).toString("hex");
      } else if (
        typeof messageData === "string" &&
        !messageData.startsWith("0x")
      ) {
        messageData = "0x" + messageData;
      }

      const message: BridgeMessage = {
        targetChainId: Number(messageResponse.get("target_chain_id")),
        targetContract: messageResponse.get("target_contract"),
        data: messageData,
      };

      console.log(
        `[GL→EVM] Relaying to chain ${message.targetChainId}/${message.targetContract}`
      );

      // Build LayerZero options
      const optionsHex = Options.newOptions()
        .addExecutorLzReceiveOption(200_000, 0)
        .toHex();

      // Get fee quote
      const dstEid = message.targetChainId; // Already LZ EID
      let nativeFee: bigint;
      try {
        const quote = await this.bridgeForwarder.quoteCallRemoteArbitrary(
          dstEid,
          message.data,
          optionsHex
        );
        nativeFee = quote[0];
      } catch (quoteErr: any) {
        console.error(`[GL→EVM] FATAL: Bridge quote failed for EID ${dstEid}.`);
        console.error(`          This usually means the bridge address for this EID is not set on the BridgeForwarder contract.`);
        console.error(`          BridgeForwarder: ${this.bridgeForwarder.target}`);
        console.error(`          Error: ${quoteErr.message}`);
        return;
      }

      console.log(
        `[GL→EVM] Fee: ${ethers.formatEther(nativeFee)} ETH`
      );

      // Send via LayerZero
      const tx = await this.bridgeForwarder.callRemoteArbitrary(
        `0x${hash}`,
        dstEid,
        message.data,
        optionsHex,
        { value: nativeFee }
      );

      console.log(`[GL→EVM] TX: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`[GL→EVM] Confirmed in block ${receipt.blockNumber}`);
      this.usedHashes.add(hash); // Mark as done only after confirmed on-chain

      // Notify XMTP group chat — resolution delivered onchain
      try {
        const targetContract = message.targetContract;
        await notifyResolved(
          targetContract,
          targetContract, // title unknown at relay time, use address as fallback
          'SIDE_A',       // actual winner decoded onchain — placeholder
          'Winner',
          '0',
          0
        );
      } catch (xmtpErr) {
        console.error('[GL→EVM] XMTP notify error (non-blocking):', xmtpErr);
      }
    } catch (error) {
      console.error(`[GL→EVM] Error relaying ${hash}:`, error);
    }
  }

  public async sync(): Promise<void> {
    try {
      console.log("[GL→EVM] Starting sync...");

      if (!(await this.ensureForwarderReady())) {
        return;
      }

      const hashes = await this.getPendingMessages();

      // On first run, log how many messages exist (don't skip — isHashUsed() handles deduplication)
      if (!this.initialized) {
        this.initialized = true;
        console.log(`[GL→EVM] Initialized, found ${hashes.length} pending messages`);
      }

      console.log(`[GL→EVM] Found ${hashes.length} pending messages`);

      for (const hash of hashes) {
        await this.relayMessage(hash);
      }

      console.log("[GL→EVM] Sync complete");
    } catch (error) {
      console.error("[GL→EVM] Sync error:", error);
    }
  }
}
