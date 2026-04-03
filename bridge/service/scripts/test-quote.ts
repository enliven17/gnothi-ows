import { ethers } from "ethers";
import dotenv from "dotenv";
import { Options } from "@layerzerolabs/lz-v2-utilities";
dotenv.config();

const BRIDGE_FORWARDER_ABI = [
  "function quoteCallRemoteArbitrary(uint32 dstEid, bytes data, bytes options) external view returns (uint256 nativeFee, uint256 lzTokenFee)",
  "function endpoint() view returns (address)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.FORWARDER_NETWORK_RPC_URL);
  const forwarderAddress = process.env.BRIDGE_FORWARDER_ADDRESS;
  if (!forwarderAddress) throw new Error("Missing BRIDGE_FORWARDER_ADDRESS");
  
  const forwarder = new ethers.Contract(forwarderAddress, BRIDGE_FORWARDER_ABI, provider);
  
  const dstEid = 40245; // Base Sepolia
  const testData = "0x" + "00".repeat(100); // Small test data
  const options = Options.newOptions().addExecutorLzReceiveOption(200_000, 0).toHex();
  
  console.log(`Testing quote on ${forwarderAddress}`);
  console.log(`  Target EID: ${dstEid}`);
  
  try {
    const quote = await forwarder.quoteCallRemoteArbitrary(dstEid, testData, options);
    console.log(`✓ Quote success! Native fee: ${ethers.formatEther(quote[0])} ETH`);
  } catch (err: any) {
    console.error(`✗ Quote failed for small data: ${err.message}`);
    if (err.data) console.error(`  Error data: ${err.data}`);
  }

  // Try again with the exact data from your logs
  const logData = "0x000000000000000000000000000000000000000000000000000000000000f22e000000000000000000000000aa4434aa1a4633ff9eacaef50dffb294937df341000000000000000000000000c2f959930d13d2796cefae4203e376c53f79fb98"; // excerpt
  try {
    console.log(`\nTesting with larger message excerpt...`);
    const quote = await forwarder.quoteCallRemoteArbitrary(dstEid, logData, options);
    console.log(`✓ Quote success! Native fee: ${ethers.formatEther(quote[0])} ETH`);
  } catch (err: any) {
    console.error(`✗ Quote failed for log data: ${err.message}`);
  }
}

main().catch(console.error);
