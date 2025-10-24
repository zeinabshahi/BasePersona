import { ethers } from "hardhat";

function addrOrNull(v?: string | null) {
  try { return (v && ethers.isAddress(v)) ? ethers.getAddress(v) : null; }
  catch { return null; }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const owner    = addrOrNull(process.env.OWNER)        ?? deployer.address;
  const treasury = addrOrNull(process.env.TREASURY)     ?? owner;
  const signer   = addrOrNull(process.env.IMAGE_SIGNER) ?? owner;

  const bmFeeEth   = process.env.BM_FEE_ETH   || "0.00002";
  const mintFeeEth = process.env.MINT_FEE_ETH || "0.00025";
  const badgeBaseUri = process.env.BADGE_BASE_URI || "ipfs://.../{id}.json";

  console.log("== Deploy config ==");
  console.log({ deployer: deployer.address, owner, treasury, signer, badgeBaseUri, bmFeeEth, mintFeeEth });

  // --- Deploy BMStreak1155
  const BM = await ethers.getContractFactory("BMStreak1155");
  const bm = await BM.deploy(badgeBaseUri, owner, treasury);
  await bm.waitForDeployment();

  const bmFeeWei = ethers.parseEther(bmFeeEth);
  if (bmFeeWei > 0n) await (await bm.setBmFeeWei(bmFeeWei)).wait();

  // --- Deploy BMImage721
  const name = process.env.NFT_NAME || "BM Persona Image";
  const symbol = process.env.NFT_SYMBOL || "BMIMG";

  const IMG = await ethers.getContractFactory("BMImage721");
  const img = await IMG.deploy(name, symbol, owner, signer, treasury);
  await img.waitForDeployment();

  const mintFeeWei = ethers.parseEther(mintFeeEth);
  if (mintFeeWei > 0n) await (await img.setMintFeeWei(mintFeeWei)).wait();

  console.log("BMStreak1155:", await bm.getAddress());
  console.log("BMImage721 :", await img.getAddress());
  console.log("Owner      :", owner);
  console.log("Treasury   :", treasury);
  console.log("Signer     :", signer);
}
main().catch((e) => { console.error(e); process.exit(1); });
