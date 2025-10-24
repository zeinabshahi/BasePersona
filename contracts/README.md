# BM Contracts (Base mainnet only)

این پوشه شامل دو قرارداد برای پروژه‌ی BM است:

- **BMStreak1155**: ثبت BM روزانه (۱بار در روز UTC)، شمارش استریک/لانگست، مینت بج‌های سول‌باند 7/30/90/180/365 روز. دارای کارمزد ثابت (`bmFeeWei`) که مستقیم به `treasury` می‌رود.
- **BMImage721**: مینت تصویر هوش مصنوعی با واچر EIP-712. تصویر Off-chain (IPFS/Arweave)، `imageHash` آن‌چین برای صحت‌سنجی. دارای کارمزد ثابت (`mintFeeWei`) که مستقیم به `treasury` می‌رود.

> فقط Base mainnet (8453). هیچ شبکه‌ی تستی تعریف نشده.

## نصب و کامپایل
```powershell
cd packages\contracts-bm
npm ci
npm run compile
```

## تنظیمات `.env`
از `.env.example` یک `.env` بساز و مقدارها را پر کن (Private Key فقط برای دیپلوی، هرگز در UI استفاده نشود):
```
BASE_RPC_URL=https://mainnet.base.org
DEPLOYER_KEY=0xYourDeployerPrivateKey

OWNER=0xYourOwnerEOA
TREASURY=0xYourTreasuryEOAorMultiSig
IMAGE_SIGNER=0xYourBackendSigner

BADGE_BASE_URI=https://your.cdn/badges/{id}.json

BM_FEE_ETH=0.00002
MINT_FEE_ETH=0.00025

NFT_NAME=BM Persona Image
NFT_SYMBOL=BMIMG
```

## دیپلوی روی Base
```powershell
npx hardhat run .\scripts\deploy.ts --network base
```

### بعد از دیپلوی
- آدرس‌ها را در UI تنظیم کن:
  - `NEXT_PUBLIC_BM_STREAK1155=0x...`
  - `NEXT_PUBLIC_BM_IMAGE721=0x...`
- در فرانت برای فراخوانی‌ها مقدار `value` را از خواندن `bmFeeWei` و `mintFeeWei` بده:
```ts
// read fees
const bmFee = await publicClient.readContract({ address: BM_STREAK, abi: BMStreak1155Abi, functionName: 'bmFeeWei' });
const mintFee = await publicClient.readContract({ address: BM_IMAGE,  abi: BMImage721Abi,  functionName: 'mintFeeWei' });

// pay & call
await writeContract({ address: BM_STREAK, abi: BMStreak1155Abi, functionName: 'bm', args: [reaction], value: bmFee });
await writeContract({ address: BM_IMAGE,  abi: BMImage721Abi,  functionName: 'claim', args: [claim, signature], value: mintFee });
```

## مدیریت بعد از دیپلوی (فقط Owner)
```ts
// تغییر مقصد کارمزد
await bm.setTreasury("0xNewTreasury");
await img.setTreasury("0xNewTreasury");

// تغییر قیمت‌ها
await bm.setBmFeeWei(ethers.parseEther("0.00002"));
await img.setMintFeeWei(ethers.parseEther("0.00025"));

// Pause/Unpause
await bm.pause(); await bm.unpause();
```



## GenerateGate

A simple paywall for AI image/text generation with a per-user daily cap.

### Deploy
```bash
# env
export OWNER=0xYourOwner
export TREASURY=0xYourTreasury
export FEE_WEI=70000000000000   # 0.00007 ETH
# run
npx hardhat run scripts/deploy-gate.ts --network base
# or base-sepolia if configured
```

### ABI surface
- `genFeeWei() -> uint256`
- `payGenerate()` / `payGenerate(bytes32 ref)`
- `remainingToday(address) -> uint8`
- `getUserQuota(address) -> (day, used, cap, remaining, totalPaid)`
- admin: `setGenFeeWei`, `setTreasury`, `setDailyCap`, `pause`, `unpause`

### Events
- `GeneratePaid(payer, ref, day, value, dailyCount, totalPaid)`
