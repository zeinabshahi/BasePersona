import { ethers } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()

  const OWNER    = process.env.OWNER || deployer.address
  const TREASURY = process.env.TREASURY || deployer.address
  // default 0.00007 ETH
  const FEE_WEI  = BigInt(process.env.FEE_WEI || "70000000000000")

  console.log("Deployer:", deployer.address)
  console.log("Owner   :", OWNER)
  console.log("Treasury:", TREASURY)
  console.log("Fee wei :", FEE_WEI.toString())

  const Gate = await ethers.getContractFactory("GenerateGate")
  const gate = await Gate.deploy(OWNER, TREASURY, FEE_WEI)
  await gate.waitForDeployment()

  console.log("GenerateGate deployed at:", await gate.getAddress())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
