import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();
const key = process.env.PRIVATE_KEY;
if (key) {
    const wallet = new ethers.Wallet(key);
    console.log("Address:", wallet.address);
} else {
    console.log("No key");
}
