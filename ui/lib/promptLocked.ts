// lib/promptLocked.ts
export type SpeciesId = 'fox'|'dolphin'|'owl'|'panda'|'tiger'|'bear'|'wolf'|'eagle';

export type LockedInputs = {
  species: SpeciesId;
  metrics?: {
    uniqContracts?: number;     // Unique Contracts
    activeDays?: number;        // Active Days
    txCount?: number;           // Transactions (total)
    gasEth?: number;            // Gas Paid (ETH)
    nftCount?: number;          // NFT unique contracts
    balanceEth?: number;        // Balance (ETH)
    rankMonthly?: number;       // Monthly Rank (lower is better)
  };
};

/** کمکی: انتخاب بازه با آخرین آستانه‌ی <= مقدار */
function bucket(value: number|undefined, stops: number[]): number {
  if (value == null || Number.isNaN(value)) return 0;
  let idx = 0;
  for (let i=0;i<stops.length;i++) if (value >= stops[i]) idx = i+1;
  return idx;
}

/** نگاشت توصیفی صرفاً با تکیه بر آستانه‌های توافق‌شده (مینیمال و پایدار) */
function describeFromMetrics(m: LockedInputs['metrics'] = {}) {
  // آستانه‌های مورد توافق کاربر
  const UNIQ_STOPS    = [20, 50, 100, 200, 500, 1000];
  const DAYS_STOPS    = [10, 20, 50, 100, 200, 500];
  const GAS_STOPS     = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];
  const RANK_STOPS    = [1000, 5000, 25000, 50000, 100000, 250000, 500000];
  const NFT_STOPS     = [1, 10, 50, 100, 200, 500];
  const BAL_STOPS     = [0.001, 0.002, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
  const TX_STOPS      = [100, 200, 500, 1000, 2000, 3000];

  const bUniq   = bucket(m.uniqContracts, UNIQ_STOPS);
  const bDays   = bucket(m.activeDays,    DAYS_STOPS);
  const bGas    = bucket(m.gasEth,        GAS_STOPS);
  const bRank   = bucket(m.rankMonthly ? (600000 - Math.min(600000, m.rankMonthly)) : 0, RANK_STOPS); // بهتر=کمتر → معکوس نرم
  const bNFT    = bucket(m.nftCount,      NFT_STOPS);
  const bBal    = bucket(m.balanceEth,    BAL_STOPS);
  const bTx     = bucket(m.txCount,       TX_STOPS);

  // Headwear از uniqContracts
  const headwear = [
    'no headwear',
    'clean beanie',
    'minimal cap',
    'thin tech visor',
    'light helmet',
    'advanced helmet',
    'ornate headdress',
  ][Math.min(bUniq, 6)];

  // Eyes از activeDays
  const eyes = [
    'bare eyes',
    'clear glasses',
    'tinted glasses',
    'smart glasses',
    'hud visor',
    'full ar visor',
  ][Math.min(bDays, 5)];

  // Clothing از txCount
  const clothing = [
    'simple tee',
    'light jacket',
    'sleek vest',
    'light armor',
    'composite suit',
    'mythic plate',
    'mythic plate', // بام‌های بالاتر به همان توصیف قفل شوند
  ][Math.min(bTx, 6)];

  // Accessory از nftCount
  const accessory = [
    'no accessory',
    'small pin',
    'woven scarf',
    'mosaic pendant',
    'holo harness',
    'floating ornaments',
    'floating ornaments',
  ][Math.min(bNFT, 6)];

  // Emblem از balanceEth (می‌توانست volume باشد، اما طبق درخواست Balance)
  const emblem = [
    'no emblem',
    'tin ring',
    'bronze circlet',
    'silver crest',
    'gold diadem',
    'platinum halo',
    'platinum halo',
    'platinum halo',
    'platinum halo',
    'platinum halo',
  ][Math.min(bBal, 9)];

  // Gas: فقط شدت درخشش جزئی
  const glow = [
    'no extra glow',
    'subtle glow',
    'soft glow',
    'mild glow',
    'bright glow',
    'strong glow',
    'intense glow'
  ][Math.min(bGas, 6)];

  // Rank (بهتر=کمتر): یک نشانه ظریف کیفیت کلی
  const rankHint = [
    'novice tier',
    'scout tier',
    'ranger tier',
    'adept tier',
    'elite tier',
    'master tier',
    'legend tier'
  ][Math.min(bRank, 6)];

  return { headwear, eyes, clothing, accessory, emblem, glow, rankHint };
}

/** متن ثابت برای هر گونه (بدنه ثابت) — تغییرناپذیر */
function speciesCue(s: SpeciesId): string {
  const map: Record<SpeciesId,string> = {
    fox:     'anthropomorphic fox character with consistent base body',
    dolphin: 'anthropomorphic dolphin character with consistent base body',
    owl:     'anthropomorphic owl character with consistent base body',
    panda:   'anthropomorphic panda character with consistent base body',
    tiger:   'anthropomorphic tiger character with consistent base body',
    bear:    'anthropomorphic bear character with consistent base body',
    wolf:    'anthropomorphic wolf character with consistent base body',
    eagle:   'anthropomorphic eagle character with consistent base body',
  };
  return map[s] || 'anthropomorphic Base-themed character with consistent base body';
}

/** سازنده پرامپت قفل‌شده (مینیمال/انیمه، پس‌زمینه تخت، ضخامت خط ثابت) */
export function buildLockedPrompt(input: LockedInputs): string {
  const d = describeFromMetrics(input.metrics);
  const subject = speciesCue(input.species);

  // مهم: سبک قفل‌شده + عدم تغییر بدنه/گونه + عدم افزودن نوشته/واترمارک
  const lines = [
    // دوربین و بدنه
    `waist-up portrait, straight-on camera, centered, symmetrical`,
    subject,
    // سبک
    `minimal anime style, clean consistent line art (constant stroke thickness), flat pastel colors`,
    // حالات لایه‌ها از تریت‌ها
    `headwear: ${d.headwear}; eyes: ${d.eyes}; clothing: ${d.clothing}; accessory: ${d.accessory}; emblem: ${d.emblem};`,
    // نور
    `${d.glow}, soft studio lighting`,
    // پس‌زمینه قفل‌شده
    `background: flat single-color Base electric blue (#0A6CFF), no patterns, no textures, no gradients`,
    // محدودیت‌ها
    `no text, no watermark, no brand logos, do not change the base species anatomy`,
    // راهنمای کیفیت
    `high detail, crisp edges, alias-free`,
    // ترکیب و نسبت
    `composition locked, 1:1 aspect ratio`
  ];

  return lines.join(', ');
}
