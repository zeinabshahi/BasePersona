import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// برای دیباگ: ببینیم چی خونده می‌شه
console.log("RPC =", process.env.BASE_RPC_URL);

if (!process.env.BASE_RPC_URL) {
  throw new Error("Missing BASE_RPC_URL in .env");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    base: {
      chainId: 8453,
      url: process.env.BASE_RPC_URL as string,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : []
    }
  }
};

export default config;
