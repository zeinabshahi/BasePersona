// lib/prompt.ts
import type { Species } from './species';
import type { TraitSelectionLite } from './traits/minimal';

export type TraitBins = {
  uniqueContracts: number;
  activeDays: number;
  gasPaidEth: number;
  monthlyRank: number;       // lower = better
  nftCount: number;
  balanceEth: number;
  txCount: number;
};

const pastelBg = [
  'soft pastel blue',
  'soft pastel mint',
  'soft pastel lavender',
  'soft pastel peach',
  'soft pastel lilac',
  'soft pastel teal',
];

// مینیمال + کارتونی + خطوط ثابت
const BASE_STYLE =
  'flat vector-style, minimal anime/cartoon, thick uniform outline, simple cel shading, clean shapes, no photorealism, no textures, no bloom, no lens flares';

const NEGATIVE =
  'photorealistic, realistic skin, gritty texture, complex patterns, text watermark, logo watermark, heavy detail, 3D render, extra limbs, background clutter';

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

function tierWord(value: number, stops: number[], words: string[]) {
  const arr = [...stops, Infinity];
  const idx = arr.findIndex((s) => value < s);
  return words[Math.max(0, Math.min(words.length - 1, idx))];
}

/**
 * نسخه‌ی قدیمیِ پرامپت قفل‌شده (vector/cartoon)
 * این تابع هنوز برای بعضی مسیرهای داخلی (مثلاً /lib/api/v1/persona) استفاده می‌شود.
 */
export function buildLockedPromptMinimal(opts: {
  species: Species;
  traits: TraitBins;
  seed: number;
}) {
  const { species, traits, seed } = opts;

  // بکگراند ثابتِ پاستیلی
  const bg = pick(pastelBg, seed);

  // مپ تریت‌ها → عناصر کم و واضح
  const headwear = tierWord(
    traits.uniqueContracts,
    [20, 50, 100, 200, 500, 1000],
    [
      'no headwear',
      'simple beanie',
      'baseball cap',
      'thin tech visor',
      'sleek helmet',
      'ornate helm',
      'heroic crest',
    ],
  );

  const eyes = tierWord(
    traits.activeDays,
    [10, 20, 50, 100, 200, 500],
    [
      'plain eyes',
      'clear glasses',
      'tinted glasses',
      'compact hud glasses',
      'wide hud visor',
      'full AR visor',
    ],
  );

  const chest = tierWord(
    traits.txCount,
    [100, 200, 500, 1000, 2000, 3000],
    [
      'plain tee',
      'light jacket',
      'minimal vest',
      'light armor',
      'composite suit',
      'mythic suit',
    ],
  );

  const emblem = tierWord(
    traits.balanceEth,
    [0.001, 0.002, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
    [
      'no emblem',
      'tiny tin ring',
      'thin silver ring',
      'bronze circlet',
      'silver crest',
      'small gold crest',
      'gold diadem',
      'bright halo',
      'platinum halo',
    ],
  );

  const accessory = tierWord(
    traits.nftCount,
    [1, 10, 50, 100, 200, 500],
    [
      'no accessory',
      'small pin',
      'woven scarf',
      'gem pendant',
      'bandolier',
      'prism harness',
    ],
  );

  // رتبه ماهانه: کمتر = بهتر → نور ملایم
  const aura = tierWord(
    traits.monthlyRank,
    [1000, 5000, 25000, 50000, 100000, 250000, 500000],
    [
      'no aura',
      'faint white aura',
      'soft blue aura',
      'soft purple aura',
      'mild gold aura',
      'bright gold aura',
      'intense platinum aura',
    ],
  );

  const gasHint = tierWord(
    traits.gasPaidEth,
    [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1],
    [
      'no energy sparks',
      'few tiny sparks',
      'tiny sparks',
      'small sparks',
      'medium sparks',
      'many sparks',
      'strong sparks',
    ],
  );

  // بدنه‌ی ثابت: حیوان آنتروپو‌مورفیک + نیم‌تنه، روبه‌رو، متقارن
  const subject =
    `waist-up symmetrical portrait of an anthropomorphic ${species} hero, front view, centered`;

  // پرامپت قفل شده
  const prompt =
    `${subject}; ${BASE_STYLE}; pastel solid background (${bg}); ` +
    `headwear: ${headwear}; eyes: ${eyes}; chestwear: ${chest}; accessory: ${accessory}; emblem: ${emblem}; ` +
    `subtle aura: ${aura}; effects: ${gasHint}; ` +
    `keep silhouette consistent for ${species}; fixed line weight; clean vector look; background must be flat and untextured`;

  return { prompt, negative: NEGATIVE };
}

/**
 * آداپتر سازگار با نسخه‌ی قدیمی:
 * lib/api/v1/persona.ts انتظار دارد buildPrompt(traits) وجود داشته باشد.
 * این تابع traits ورودی را تا حد ممکن به TraitBins تبدیل می‌کند و
 * از buildLockedPromptMinimal برای ساخت پرامپت استفاده می‌کند.
 */
export function buildPrompt(traits: any): string {
  try {
    const bins: TraitBins = {
      uniqueContracts: Number(
        traits?.uniqueContracts ??
          traits?.unique_contracts ??
          traits?.contracts ??
          0,
      ),
      activeDays: Number(
        traits?.activeDays ??
          traits?.active_days ??
          traits?.days_active ??
          0,
      ),
      gasPaidEth: Number(
        traits?.gasPaidEth ??
          traits?.gas_eth ??
          traits?.gasSpentEth ??
          0,
      ),
      monthlyRank: Number(
        traits?.monthlyRank ??
          traits?.monthly_rank ??
          traits?.rank ??
          500000,
      ),
      nftCount: Number(
        traits?.nftCount ??
          traits?.nft_mints ??
          traits?.nftContracts ??
          0,
      ),
      balanceEth: Number(
        traits?.balanceEth ??
          traits?.balance_eth ??
          traits?.avgBalanceEth ??
          0,
      ),
      txCount: Number(
        traits?.txCount ??
          traits?.total_txs ??
          traits?.txCountTotal ??
          0,
      ),
    };

    const species: Species =
      (traits?.species as Species) ||
      (traits?.speciesId as Species) ||
      // پیش‌فرض اگه چیزی نداشتیم
      ('owl' as Species);

    const masterSeed =
      Number(process.env.IMG_MASTER_SEED ?? '424242') || 424242;

    const { prompt } = buildLockedPromptMinimal({
      species,
      traits: bins,
      seed: masterSeed,
    });

    return prompt;
  } catch {
    // در بدترین حالت یه پرامپت جنریک ولی تمیز
    return 'waist-up portrait of a Base-native onchain persona, flat vector-style, minimal cartoon, thick uniform outline, soft pastel background, 1:1 aspect ratio';
  }
}

/**
 * سازگار با API قدیمی buildAnimeLitePrompt که توی pages/api/prompt.ts استفاده می‌شه.
 * این تابع از TraitSelectionLite استفاده می‌کنه و یه پرامپت مینیمال انیمه می‌سازه.
 */
export function buildAnimeLitePrompt(
  selection: TraitSelectionLite,
  opts?: { seed?: number },
) {
  try {
    const species = (selection?.styleLock?.species as Species) || ('owl' as Species);
    const seed =
      opts?.seed ??
      (Number(process.env.IMG_MASTER_SEED ?? '424242') || 424242);

    // یک subject ساده بر اساس species
    const subject =
      `waist-up anime portrait of an anthropomorphic ${species} avatar, front view, centered`;

    const bgHex = selection?.styleLock?.bgColorHex || '#E6F0FF';

    const detailParts = Object.values(selection?.traits || {})
      .map((t) => {
        const slot = String(t.slot || '').toLowerCase();
        return `${slot}: ${t.prompt}`;
      });

    const prompt =
      `${subject}; ${BASE_STYLE}; flat solid pastel background ${bgHex}; ` +
      detailParts.join('; ') +
      '; clean silhouette, no extra props, no complex background';

    // از همون NEGATIVE مشترک استفاده می‌کنیم
    return { prompt, negative: NEGATIVE };
  } catch {
    // fallback اگر هر مشکلی بود
    return {
      prompt:
        'waist-up anime portrait of a Base-native onchain avatar, flat vector-style, minimal cartoon, soft pastel solid background, 1:1',
      negative: NEGATIVE,
    };
  }
}
