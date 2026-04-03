import { ethers } from "ethers";
import dotenv from "dotenv";
import { Options } from "@layerzerolabs/lz-v2-utilities";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.FORWARDER_NETWORK_RPC_URL);
  const forwarderAddress = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E";
  const forwarder = new ethers.Contract(forwarderAddress, ["function quoteCallRemoteArbitrary(uint32 dstEid, bytes data, bytes options) external view returns (uint256 nativeFee, uint256 lzTokenFee)"], provider);

  const dstEid = 40245;
  const testData = "0x";
  const options = Options.newOptions().addExecutorLzReceiveOption(200_000, 0).toHex();

  console.log("Quoting from new forwarder...");
  try {
    const quote = await forwarder.quoteCallRemoteArbitrary(dstEid, testData, options);
    console.log("✓ Success! Native fee:", ethers.formatEther(quote[0]));
  } catch (err: any) {
    console.error("✗ Failure:", err.message);
  }
}

main().catch(console.error);
