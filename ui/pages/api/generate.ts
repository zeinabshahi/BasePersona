// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/* -------------------------- small helpers -------------------------- */

function isAddr(s?: string) {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(String(s));
}

function hashSeed(str: string) {
  // FNV-1a ساده و پایدار روی هر رشته (آدرس یا آدرس+salt)
  let h = 2166136261 >>> 0;
  const s = String(str).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 1_000_000_000;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const isDataUrl = (u: string) =>
  typeof u === 'string' && u.startsWith('data:');

/** نرمالایز: هرچی بدی، آخرش /api/v1 می‌شه */
function ensureApiBase(input?: string) {
  if (!input) return 'https://openrouter.ai/api/v1';
  const u = input.replace(/\/+$/, '');
  if (u.endsWith('/api/v1')) return u;
  if (u.endsWith('/api')) return u + '/v1';
  return u + '/api/v1';
}

/** تبدیل URL ریموت به data: */
async function urlToDataUrl(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch_image_failed_${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/png';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

/* ---------------------- deterministic species (8) ---------------------- */

const SPECIES: readonly string[] = [
  'owl',
  'fox',
  'whale',
  'panda',
  'tiger',
  'wolf',
  'cheetah',
  'dolphin',
];

function pickSpeciesByNibble(address: string): string {
  const nibble = parseInt(address.slice(-1), 16);
  return SPECIES[nibble % SPECIES.length];
}

/* --------------------- buckets & raw traits (exact spec) --------------------- */

const BUCKET = {
  // UC (Unique Contracts)
  UC: [1, 5, 10, 20, 40, 60, 80, 100, 150, 200, 300, 500, 800, 1000],
  // AD (Active Days)
  AD: [1, 5, 10, 20, 30, 45, 60, 90, 120, 180, 240, 300, 365, 500],
  // GAS (ETH)
  GAS: [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2],
  // RANK (top)
  RANK: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
  // NFT count
  NFT: [1, 3, 5, 10, 20, 50, 100, 200],
  // BAL (ETH)
  BAL: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 3, 5],
  // TX count
  TX: [10, 20, 50, 100, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000, 8000, 10000],
};

function bucketFloor(v: number, arr: number[]) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  let b = 0;
  for (const t of arr) {
    if (v >= t) b = t;
    else break;
  }
  return b;
}

// برای Rank: مقدار کمتر بهتر است → کوچک‌ترین سقف ≥ v
function bucketRankTop(v: number, arr: number[]) {
  if (!Number.isFinite(v) || v <= 0) return arr[arr.length - 1];
  for (const t of arr) {
    if (v <= t) return t;
  }
  return arr[arr.length - 1];
}

type RawTraits = {
  uniqueContracts: number;
  activeDays: number;
  gasPaidEth: number;
  monthlyRank: number;
  nftCount: number;
  balanceEth: number;
  txCount: number;
};

type Bucketed = {
  UC: number;
  AD: number;
  GAS: number;
  RANK: number;
  NFT: number;
  BAL: number;
  TX: number;
};

function toBucketsAndTokens(rt: RawTraits): { buckets: Bucketed; tokens: string[] } {
  const UC = bucketFloor(rt.uniqueContracts, BUCKET.UC);
  const AD = bucketFloor(rt.activeDays, BUCKET.AD);
  const GAS = bucketFloor(rt.gasPaidEth, BUCKET.GAS);
  const RANK = bucketRankTop(rt.monthlyRank, BUCKET.RANK);
  const NFT = bucketFloor(rt.nftCount, BUCKET.NFT);
  const BAL = bucketFloor(rt.balanceEth, BUCKET.BAL);
  const TX = bucketFloor(rt.txCount, BUCKET.TX);

  const tokens: string[] = [];
  if (UC > 0) tokens.push(`UC_${UC}`);
  if (AD > 0) tokens.push(`AD_${AD}`);
  if (GAS > 0) tokens.push(`GAS_${GAS}`);
  if (RANK > 0) tokens.push(`RANK_TOP_${RANK}`);
  if (NFT > 0) tokens.push(`NFT_${NFT}`);
  if (BAL > 0) tokens.push(`BAL_${BAL}`);
  if (TX > 0) tokens.push(`TX_${TX}`);

  return { buckets: { UC, AD, GAS, RANK, NFT, BAL, TX }, tokens };
}

/* ------------------------ visual trait dictionaries (spec) ------------------------ */

// Outfit (۱۰ گزینه)
const OUTFIT_DEFAULT: readonly string[] = [
  'hoodie',
  'windbreaker',
  'tracksuit',
  'biker_jacket',
  'mechanic_overall',
] as const;

const OUTFIT_HIGH_UC_TX: readonly string[] = [
  'utility_vest',
  'exo_lite_armor',
  'flight_jacket',
] as const;

const OUTFIT_BAL: readonly string[] = [
  'minimal_suit',
  'robe',
] as const;

// Eyewear (همیشه یه چیزی هست؛ دیگه none نداریم)
const EYEWEAR_VISORS: readonly string[] = [
  'thin_visor',
  'wide_visor',
  'mono_visor',
  'nano_specs',
] as const;

const EYEWEAR_NON_VISORS: readonly string[] = [
  'round_glasses',
  'square_glasses',
  'aviator',
  'goggles_min',
  'shutter_shades',
] as const;

// Head/Hair (همه‌شون visible هستن؛ دیگه none تو fallback نداریم)
const HEAD_FALLBACK: readonly string[] = [
  'hood_up',
  'cap_forward',
  'beanie',
  'short_hair',
  'side_part',
  'messy_hair',
  'buzz',
] as const;

// Accessories (patches + سایر کوچک‌ها)
const ACCESSORY_PATCHES: readonly string[] = [
  'patch_geo_circle',
  'patch_geo_triangle',
  'patch_geo_square',
] as const;

const ACCESSORY_OTHER: readonly string[] = [
  'thin_pendant',
  'tag_card',
  'scarf_min',
  'comms_earpiece',
  'tiny_earring',
  'wrist_band',
  'utility_band',
] as const;

// Emblem (بدون chevron که rule خاص خودش را دارد)
const EMBLEM_OPTIONS: readonly string[] = [
  'hex',
  'diamond',
  'base_glyph',
  'circuit_node',
] as const;

/* ------------ human-readable descriptions for each visual trait ------------ */

const OUTFIT_DESCRIPTIONS: Record<string, string> = {
  hoodie:
    'simple modern hoodie with a clean front, Base-blue drawstrings, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  windbreaker:
    'lightweight windbreaker jacket with a front zipper and subtle Base-blue piping, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  tracksuit:
    'minimal tracksuit jacket with a zipper and soft stripes on the sleeves, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  biker_jacket:
    'chunky biker-style jacket with simplified panels and seams, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  mechanic_overall:
    'one-piece mechanic-style overall with a simple front zipper and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  utility_vest:
    'tech utility vest with simplified pockets and panels, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  exo_lite_armor:
    'minimal sci-fi exo-lite armor vest with smooth plates, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  flight_jacket:
    'short flight jacket in pastel navy with soft cuffs and collar, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  minimal_suit:
    'clean minimal suit jacket with no tie, and exactly one small, plain, flat square Base-blue logo patch pinned like a badge on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
  robe:
    'simple modern robe with a belt, and exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)',
};

const EYEWEAR_DESCRIPTIONS: Record<string, string> = {
  thin_visor: 'a thin horizontal sci-fi visor across the eyes, slightly glowing Base-blue',
  wide_visor: 'a wide wraparound visor covering the eyes, with a soft Base-blue glow',
  mono_visor: 'a single narrow mono-visor over both eyes with a Base-blue accent line',
  nano_specs: 'tiny minimal glasses with a subtle Base-blue edge',
  round_glasses: 'round glasses with thin frames',
  square_glasses: 'square glasses with medium frames',
  aviator: 'aviator-style glasses with slightly tinted lenses',
  goggles_min: 'small simple goggles resting over the eyes',
  shutter_shades: 'shutter shades with horizontal slats',
};

const HEAD_DESCRIPTIONS: Record<string, string> = {
  headband: 'a visible Base-blue headband around the forehead',
  hood_up: 'the outfit hood is up over the head in a relaxed way',
  cap_forward: 'a simple cap worn forward',
  beanie: 'a soft beanie on the head',
  short_hair: 'short tidy hair visible on the head',
  side_part: 'hair with a side part',
  messy_hair: 'slightly messy hair',
  buzz: 'very short buzz-cut hair',
  minimal_helmet: 'a minimal smooth helmet that matches the outfit',
};

const ACCESSORY_DESCRIPTIONS: Record<string, string> = {
  patch_geo_circle:
    'a small circular Base-blue patch on the upper-left chest, placed very close to (but clearly separate from) the main square Base-blue logo patch',
  patch_geo_triangle:
    'a small Base-blue triangle patch on the upper-left chest, placed very close to (but clearly separate from) the main square Base-blue logo patch',
  patch_geo_square:
    'a small extra square patch just under the main square Base-blue logo patch on the upper-left chest, slightly smaller than the main logo square',
  thin_pendant: 'a tiny pendant hanging from a short chain at the neck',
  tag_card: 'a small ID tag card hanging from a short lanyard around the neck',
  scarf_min: 'a very simple short scarf around the neck',
  comms_earpiece: 'a tiny comms earpiece in one ear',
  tiny_earring: 'a very small earring on one ear',
  wrist_band: 'a simple Base-blue wristband on the right wrist, clearly visible',
  utility_band: 'a small utility band around one forearm',
};

const EMBLEM_DESCRIPTIONS: Record<string, string> = {
  chevron:
    'a small chevron emblem printed on the chest, directly above or near the square Base-blue logo patch',
  hex: 'a tiny hexagon emblem printed on the chest near the square Base-blue logo patch',
  diamond: 'a small diamond-shaped emblem printed on the chest near the square Base-blue logo patch',
  base_glyph:
    'a tiny abstract Base-style glyph printed on the chest near the square Base-blue logo patch',
  circuit_node:
    'a small circuit-node emblem printed on the chest near the square Base-blue logo patch',
};

/* ------------------------ helpers: deterministic picking ------------------------ */

function pickDeterministic(
  list: readonly string[],
  address: string,
  salt: string,
): string {
  if (!list.length) throw new Error('empty list for pickDeterministic');
  const h = hashSeed(`${address}:${salt}`);
  const idx = h % list.length;
  return list[idx];
}

/* ------------------------ helpers: background & body color ------------------------ */

/**
 * توضیح پس‌زمینه (Base-inspired ولی روشن و شاد)
 * name فقط برای لاگ است، desc وارد پرامپت می‌شود.
 */
const BG_DESCRIPTIONS: readonly string[] = [
  'bright Base-blue to cyan gradient with a soft orb glow',
  'fresh sky-blue to mint gradient, light and clean',
  'cool aqua to teal gradient with a soft vignette',
  'soft turquoise to ice-blue gradient with gentle light from above',
  'pale indigo to periwinkle gradient, very soft and luminous',
  'pastel cyan to lavender gradient with a faint Base orb halo',
  'bright turquoise to soft seafoam gradient, airy and open',
  'sky-blue to white gradient, studio backdrop style',
  'aqua to soft teal gradient with subtle radial light in the center',
  'soft electric blue to navy gradient, mild vignette',
  'periwinkle to pale cyan gradient, smooth and calm',
  'ice-blue to soft turquoise gradient, very clear and non-muddy',
];

function getBgPastel(species: string): { name: string; desc: string } {
  const masterSeed = Number(process.env.IMG_MASTER_SEED ?? '424242');
  const speciesIndex = Math.max(0, SPECIES.indexOf(species));
  const idxRaw = (masterSeed + speciesIndex) % BG_DESCRIPTIONS.length;
  const idx = (idxRaw + BG_DESCRIPTIONS.length) % BG_DESCRIPTIONS.length;
  return {
    name: `pastel_${idx}`,
    desc: BG_DESCRIPTIONS[idx],
  };
}

/**
 * رنگ «طبیعی» بدن برای هر گونه + اکسنت‌های کوچک Base-blue.
 * این توصیف بین همه‌ی رندرها برای یک species ثابت می‌ماند.
 */
function getSpeciesBodyColor(species: string): string {
  switch (species) {
    case 'owl':
      return 'warm beige and soft brown feathers with a light face mask and small Base-blue accent on a feather tip';
    case 'fox':
      return 'classic orange fur with cream muzzle and tail tip, plus a tiny Base-blue patch or stripe';
    case 'whale':
      return 'deep blue-grey skin with a lighter underside, with a subtle Base-blue highlight along the back';
    case 'panda':
      return 'white and charcoal fur like a giant panda, with a small Base-blue accent tag or marking';
    case 'tiger':
      return 'orange fur with soft darker stripes, plus a tiny Base-blue stripe or charm';
    case 'wolf':
      return 'cool grey fur with lighter snout and chest, with a small Base-blue ear or collar accent';
    case 'cheetah':
      return 'golden yellow fur with soft darker spots, with a minimal Base-blue accent near the collar or tail';
    case 'dolphin':
      return 'smooth blue-grey skin with lighter belly, with a Base-blue highlight along the fin or side';
    default:
      return 'natural soft fur tones with a very small Base-blue accent';
  }
}

/* ------------------------ map buckets → visual traits ------------------------ */

type VisualTraits = {
  outfit: string;
  eyewear: string;
  head: string;
  accessories: string[];
  emblem: string;
  detail: number; // 0..5
  bgPastelName: string;
  bgPastelDesc: string;
  bodyColorDesc: string;
};

function mapBucketsToVisualTraits(
  buckets: Bucketed,
  species: string,
  address: string,
): VisualTraits {
  const { UC, AD, GAS, RANK, NFT, BAL, TX } = buckets;

  // Outfit → هرچی UC/TX/RANK خفن‌تر، outfit تکنیکال‌تر
  let outfit: string;
  if (UC >= 500 || TX >= 5000 || RANK <= 10000) {
    outfit = pickDeterministic(OUTFIT_HIGH_UC_TX, address, 'outfit_high_uc_tx_elite');
  } else if (UC >= 200 && TX >= 1000) {
    outfit = pickDeterministic(OUTFIT_HIGH_UC_TX, address, 'outfit_high_uc_tx');
  } else if (BAL >= 0.5) {
    outfit = pickDeterministic(OUTFIT_BAL, address, 'outfit_balance');
  } else {
    outfit = pickDeterministic(OUTFIT_DEFAULT, address, 'outfit_default');
  }

  // Eyewear → UC / GAS / TX / RANK هرچی بیشتر، احتمال visor بیشتر
  let eyewear: string;
  if (UC >= 150 || GAS >= 0.01 || TX >= 1500 || RANK <= 100000) {
    eyewear = pickDeterministic(EYEWEAR_VISORS, address, 'eyewear_visor');
  } else {
    eyewear = pickDeterministic(EYEWEAR_NON_VISORS, address, 'eyewear_basic');
  }

  // Head / Hair → همیشه یه چیز visible هست
  let head: string;
  if (AD >= 90) {
    head = 'headband';
  } else if (RANK <= 5000) {
    if (outfit === 'minimal_suit' || outfit === 'robe') {
      head = 'hood_up';
    } else {
      head = 'minimal_helmet';
    }
  } else {
    head = pickDeterministic(HEAD_FALLBACK, address, 'head_default');
  }

  // Accessories (دقیقاً حداکثر ۲، و تلاش برای ۲ همیشه)
  const accessories: string[] = [];

  // NFT → patch_geo_*
  if (NFT >= 20) {
    const first = pickDeterministic(ACCESSORY_PATCHES, address, 'acc_patch1');
    accessories.push(first);
    if (accessories.length < 2) {
      const remaining = ACCESSORY_PATCHES.filter((p) => p !== first);
      if (remaining.length > 0) {
        accessories.push(
          pickDeterministic(remaining, address, 'acc_patch2'),
        );
      }
    }
  } else if (NFT >= 1) {
    const first = pickDeterministic(ACCESSORY_PATCHES, address, 'acc_patch_single');
    accessories.push(first);
  }

  // شرط‌های مبتنی بر TX / BAL / UC
  if (TX >= 1000 && accessories.length < 2) {
    accessories.push('wrist_band');
  }
  if (BAL >= 0.3 && accessories.length < 2) {
    accessories.push('thin_pendant');
  }
  if (UC >= 200 && accessories.length < 2) {
    accessories.push('comms_earpiece');
  }

  // اگر هنوز کمتر از ۲ تاست، از سایر اکسسوری‌های کوچک پر می‌کنیم تا دقیقاً ۲ تا شود
  while (accessories.length < 2) {
    const remaining = ACCESSORY_OTHER.filter((a) => !accessories.includes(a));
    if (!remaining.length) break;
    accessories.push(
      pickDeterministic(remaining, address, `acc_fallback_${accessories.length}`),
    );
  }
  accessories.splice(2); // hard cap = 2

  // Emblem
  let emblem: string;
  if (RANK <= 25000) {
    emblem = 'chevron';
  } else {
    emblem = pickDeterministic(EMBLEM_OPTIONS, address, 'emblem');
  }

  // Detail level (0..5) از UC + GAS + TX → خفن‌ترها خطوط مدار بیشتر
  const ucNorm =
    UC > 0 ? Math.min(1, UC / BUCKET.UC[BUCKET.UC.length - 1]) : 0;
  const gasNorm =
    GAS > 0 ? Math.min(1, GAS / BUCKET.GAS[BUCKET.GAS.length - 1]) : 0;
  const txNorm =
    TX > 0 ? Math.min(1, TX / BUCKET.TX[BUCKET.TX.length - 1]) : 0;

  let detail = Math.floor(ucNorm * 2 + gasNorm * 2 + txNorm * 2);
  detail = clamp(detail, 1, 5); // حداقل ۱ که همیشه یه لِول دیتیل داشته باشه

  const bg = getBgPastel(species);
  const bodyColorDesc = getSpeciesBodyColor(species);

  return {
    outfit,
    eyewear,
    head,
    accessories,
    emblem,
    detail,
    bgPastelName: bg.name,
    bgPastelDesc: bg.desc,
    bodyColorDesc,
  };
}

/* ------------------------ locked 3D prompt builder (style-locked) ------------------------ */

function buildLockedPrompt3D(input: {
  species: string;
  tokens: string[];
  seed: number;
  visual: VisualTraits;
  walletAddress: string;
}) {
  const { species, tokens, seed, visual, walletAddress } = input;

  const tokensCsv =
    tokens && tokens.length ? tokens.join(', ') : 'none';

  const outfitDesc =
    OUTFIT_DESCRIPTIONS[visual.outfit] ??
    `${visual.outfit} outfit with exactly one small, plain, flat square Base-blue logo patch on the upper-left chest (pure solid Base-blue, no icon or symbol inside)`;

  const eyewearDesc =
    EYEWEAR_DESCRIPTIONS[visual.eyewear] ?? visual.eyewear;

  const headDesc =
    HEAD_DESCRIPTIONS[visual.head] ?? visual.head;

  const accessoriesDesc =
    visual.accessories.length
      ? visual.accessories
          .map((a) => ACCESSORY_DESCRIPTIONS[a] ?? a)
          .join('; ')
      : 'no extra accessories beyond the Base-blue logo patch';

  const emblemDesc =
    EMBLEM_DESCRIPTIONS[visual.emblem] ?? visual.emblem;

    const STYLE = `Stylized soft 3D character render, toy-like and slightly chunky.
Full-body standing (head-to-toe visible), single subject, square 1:1 frame, centered.
Camera is perfectly straight-on at eye level, with the character facing directly forward.
Face, chest, and shoulders must be square to the camera (no twist, no turn left or right).
Clear 3D volume with rounded forms, subtle shadows and highlights.
High quality soft studio lighting with gentle global illumination (no harsh contrast).
Matte or satin materials only, no PBR gloss or mirror reflections.
Background is a clean Base-inspired pastel gradient with a subtle orb glow, no props, no environment clutter.`;

  const COLOR_GUIDE = `Color and brand rules:
- Body uses natural ${species} colors with a very small Base-blue accent: ${visual.bodyColorDesc}.
- Outfit and accessories must clearly contrast with the body (navy, dark teal, cool greys, off-white, muted cyan or gold accents).
- ALWAYS include exactly one small, plain, flat square Base-blue logo patch on the upper-left chest area of the outfit, like a simple 2D sticker. It is a pure solid Base-blue color, with no icon, symbol, or text inside.
- Do NOT make the whole character a single flat color; keep body, outfit, and accessories as distinct readable color blocks.
- Background: ${visual.bgPastelName} — ${visual.bgPastelDesc}. It should be slightly lighter and fresher than the character, never muddy or washed out.
- Overall palette should feel bright, clean, and modern — Base-blue flavored, but not monochrome.`;

  const BODY = `Character: anthropomorphic ${species} representing a Base onchain wallet persona.
The base body silhouette, proportions, and default pose for this species are locked and must remain consistent across all renders in the collection.`;

  const TRAITS = `VISUAL TRAITS — ALL of the following items are MANDATORY and must appear clearly in the image.
Do NOT omit or hide any of them. Do NOT invent any extra gear beyond what is listed here.

Outfit (must be clearly visible): ${outfitDesc}.
Eyewear (must be clearly visible on the face): ${eyewearDesc}.
Head / Hair: ${headDesc}.
Accessories (exactly up to 2 small items, all must be visible): ${accessoriesDesc}.
Chest Emblem: ${emblemDesc}.
Detail Level: detail_${visual.detail} — subtle soft circuit lines and panel details on the outfit, according to this level.
Background: ${visual.bgPastelName} — ${visual.bgPastelDesc}, clean studio gradient with a soft Base orb glow.`;

  const TOKENS = `On-chain intensity tokens (guide only, not new items): ${tokensCsv}.
These tokens may influence subtle lighting contrast, expression attitude, and posture confidence, but must NOT add any new gear or objects.`;

    const FRAMING = `Framing and composition rules:
- Full body in frame (no cropping at feet, ears, or head).
- Camera is straight-on at eye level; the ${species} faces the viewer directly.
- Head, torso, and feet are aligned to the camera (no three-quarter angle, no side view, no tilt).
- Arms relaxed or in a confident but simple stance — no extreme poses, no hand close-ups.
- No extra props, no floating items, no multiple characters.
- No text or UI or watermark inside the image. The ONLY logo-like element allowed is one small plain square Base-blue patch on the outfit.`;


  const CONTEXT = `Context: Base mainnet wallet ${walletAddress}. Deterministic collection seed ${seed} — style and camera must stay consistent across the entire collection.`;

  const prompt = `${STYLE}

${COLOR_GUIDE}

${BODY}

${TRAITS}

${TOKENS}

${FRAMING}

${CONTEXT}`.trim();

    const NEGATIVE = `flat 2D vector illustration, flat cel shading, close-up, portrait, bust, half-body, cropped,
three-quarter view, 3/4 view, side view, profile view, angled view, dutch angle, over-the-shoulder,
character turned left, character turned right, looking away from camera,
photorealistic, realistic skin, pores, PBR, glossy, metallic reflections, raytraced reflections,
complex background, detailed environment, cityscape, room, props, furniture, multiple characters,
hands close-up, fingers in foreground, text, watermark, UI elements, gritty, horror, gore`;


  return { prompt, negative: NEGATIVE };
}

/* ----------------------- OpenRouter chat.completions (image) ----------------------- */

async function callOpenRouterImages(opts: {
  prompt: string;
  negative?: string;
  size: string;
  seed?: number;
}) {
  const base = ensureApiBase(process.env.OPENROUTER_BASE_URL);

  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.IMG_OPENROUTER_API_KEY ||
    process.env.LLM_OPENROUTER_API_KEY;

  const model =
    process.env.IMG_OPENROUTER_MODEL &&
    process.env.IMG_OPENROUTER_MODEL.trim() !== ''
      ? process.env.IMG_OPENROUTER_MODEL
      : 'openai/gpt-5-image';

  const site = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const app = process.env.OPENROUTER_SITE_NAME || 'Rankora Persona';

  if (!key) {
    return { ok: false as const, error: 'missing_openrouter_key' };
  }

  const content = opts.negative
    ? `${opts.prompt}\n\nAvoid the following in the image: ${opts.negative}`
    : opts.prompt;

  const body: Record<string, any> = {
    model,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    modalities: ['image', 'text'],
    stream: false,
  };

  if (opts.seed != null) {
    body.seed = opts.seed;
  }

  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'HTTP-Referer': site,
        'X-Title': app,
      },
      body: JSON.stringify(body),
    });

    const ct = r.headers.get('content-type') || '';
    const text = await r.text();

    if (!ct.includes('application/json')) {
      return {
        ok: false as const,
        error: 'openrouter_200_but_html',
        raw: text.slice(0, 240),
      };
    }

    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      return {
        ok: false as const,
        error: 'chat_completions_json_parse_error',
        raw: text.slice(0, 240),
      };
    }

    if (!r.ok) {
      const m = j?.error?.message || j?.error || `openrouter_${r.status}`;
      return { ok: false as const, error: m, raw: j };
    }

    const msg = j?.choices?.[0]?.message;
    const imgFromArray = (msg?.images && msg.images[0]) || null;
    const imgFromContent =
      Array.isArray(msg?.content)
        ? msg.content.find(
            (c: any) =>
              c?.type === 'output_image' ||
              c?.type === 'image' ||
              c?.image_url,
          )
        : null;

    const url: string | undefined =
      imgFromArray?.image_url?.url ||
      imgFromArray?.imageUrl?.url ||
      imgFromArray?.url ||
      imgFromContent?.image_url?.url ||
      imgFromContent?.url;

    if (!url) {
      return {
        ok: false as const,
        error: 'no_image_in_chat_completion_response',
        raw: j,
      };
    }

    return { ok: true as const, imageURL: url };
  } catch (err: any) {
    return {
      ok: false as const,
      error: `openrouter_fetch_failed: ${String(err?.message || err)}`,
    };
  }
}

/* --------------------------------- API --------------------------------- */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const { address, traitsJson } = (req.body || {}) as {
      address?: string;
      traitsJson?: Partial<RawTraits>;
    };

    if (!isAddr(address)) {
      return res.status(400).json({ ok: false, error: 'bad_address' });
    }

    const addr = address as string;
    const species = pickSpeciesByNibble(addr);

    const traits: RawTraits = {
      uniqueContracts: Number(traitsJson?.uniqueContracts ?? 0),
      activeDays: Number(traitsJson?.activeDays ?? 0),
      gasPaidEth: Number(traitsJson?.gasPaidEth ?? 0),
      monthlyRank: Number(traitsJson?.monthlyRank ?? 500000),
      nftCount: Number(traitsJson?.nftCount ?? 0),
      balanceEth: Number(traitsJson?.balanceEth ?? 0),
      txCount: Number(traitsJson?.txCount ?? 0),
    };

    const { buckets, tokens } = toBucketsAndTokens(traits);

    // seed کالکشن
    const masterSeed = Number(process.env.IMG_MASTER_SEED ?? '424242');
    const seedMode = process.env.IMG_SEED_MODE || 'collection';
    const addrHash = hashSeed(addr);

    const seed =
      seedMode === 'collection_xor_wallet'
        ? (masterSeed ^ addrHash) % 1_000_000_000
        : masterSeed;

    const visual = mapBucketsToVisualTraits(buckets, species, addr);

    const { prompt, negative } = buildLockedPrompt3D({
      species,
      tokens,
      seed,
      visual,
      walletAddress: addr,
    });

    const size = String(process.env.IMG_SIZE || '1024x1024');

    const out = await callOpenRouterImages({
      prompt,
      negative,
      size,
      seed,
    });

    if (!out.ok) {
      return res.status(502).json({
        ok: false,
        error: out.error,
        debug: (out as any).raw ?? null,
      });
    }

    const imageURL = isDataUrl((out as any).imageURL)
      ? (out as any).imageURL
      : await urlToDataUrl((out as any).imageURL);

    return res.status(200).json({
      ok: true,
      imageURL, // همیشه data:
      promptUsed: prompt,
      size,
      species,
      tokens,
      buckets,
      visualTraits: visual,
    });
  } catch (e: any) {
    console.error('[api/generate] fatal:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || 'generate_failed'),
    });
  }
}
