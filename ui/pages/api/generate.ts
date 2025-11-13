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

/* --------------------- buckets & raw traits --------------------- */

const BUCKET = {
  UC: [20, 40, 60, 80, 100, 150, 200, 300, 500, 800, 1000],
  AD: [20, 30, 50, 70, 90, 120, 180, 240, 300, 365, 500],
  GAS: [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2],
  RANK: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
  NFT: [1, 3, 5, 10, 20, 50, 100, 200],
  BAL: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 3, 5],
  TX: [20, 50, 100, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000, 8000, 10000],
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

/* ------------------------ visual trait dictionaries ------------------------ */

const OUTFIT_OPTIONS = [
  'hoodie',
  'windbreaker',
  'tracksuit',
  'biker_jacket',
  'mechanic_overall',
  'utility_vest',
  'exo_lite_armor',
  'flight_jacket',
  'minimal_suit',
  'robe',
] as const;

const EYEWEAR_VISORS = [
  'thin_visor',
  'wide_visor',
  'mono_visor',
  'nano_specs',
] as const;

const EYEWEAR_NON_VISORS = [
  'none',
  'round_glasses',
  'square_glasses',
  'aviator',
  'goggles_min',
] as const;

const HEAD_FALLBACK = [
  'hood_up',
  'cap_forward',
  'beanie',
  'short_hair',
  'side_part',
  'messy_hair',
  'buzz',
  'none',
] as const;

const PATCHES = [
  'patch_geo_circle',
  'patch_geo_triangle',
  'patch_geo_square',
] as const;

const EMBLEM_OPTIONS = [
  'hex',
  'diamond',
  'base_glyph',
  'circuit_node',
] as const;

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

/* ------------------------ helpers: species background & body color ------------------------ */

function getSpeciesBackgroundColor(species: string): string {
  switch (species) {
    case 'owl':
      return 'warm beige pastel';
    case 'fox':
      return 'soft orange pastel';
    case 'whale':
      return 'soft aqua blue pastel';
    case 'panda':
      return 'mint pastel';
    case 'tiger':
      return 'peach orange pastel';
    case 'wolf':
      return 'cool blue-grey pastel';
    case 'cheetah':
      return 'soft yellow pastel';
    case 'dolphin':
      return 'light teal pastel';
    default:
      return 'soft neutral pastel';
  }
}

// بدن هر حیوون همیشه در تون‌های آبی/تیل (لباس‌ها آزاد)
function getSpeciesBodyColor(species: string): string {
  switch (species) {
    case 'owl':
      return 'soft sky-blue with slightly darker blue around the face';
    case 'fox':
      return 'bright cyan-blue with deeper navy accents on ears and tail';
    case 'whale':
      return 'deep ocean blue with lighter teal highlights';
    case 'panda':
      return 'powder blue with darker blue patches instead of black';
    case 'tiger':
      return 'cool electric blue with slightly darker striping';
    case 'wolf':
      return 'blue-grey with navy shadow areas';
    case 'cheetah':
      return 'pale ice-blue with slightly darker blue spots';
    case 'dolphin':
      return 'soft teal-blue with a lighter belly area';
    default:
      return 'neutral soft blue';
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
  bgPastelName: string; // e.g. pastel_3
  bgPastelDesc: string; // human text, e.g. "soft aqua blue pastel"
};

function mapBucketsToVisualTraits(
  buckets: Bucketed,
  species: string,
  address: string,
): VisualTraits {
  const { UC, AD, GAS, RANK, NFT, BAL, TX } = buckets;

  // Outfit
  let outfit: string;
  if (UC >= 200 && TX >= 1000) {
    outfit = pickDeterministic(
      ['utility_vest', 'exo_lite_armor', 'flight_jacket'],
      address,
      'outfit_high_uc_tx',
    );
  } else if (BAL >= 0.5) {
    outfit = pickDeterministic(
      ['minimal_suit', 'robe'],
      address,
      'outfit_balance',
    );
  } else {
    outfit = pickDeterministic(
      ['hoodie', 'windbreaker', 'tracksuit', 'biker_jacket', 'mechanic_overall'],
      address,
      'outfit_default',
    );
  }

  // Eyewear
  let eyewear: string;
  if (UC >= 100 || GAS >= 0.01) {
    eyewear = pickDeterministic(EYEWEAR_VISORS, address, 'eyewear_visor');
  } else {
    eyewear = pickDeterministic(
      EYEWEAR_NON_VISORS,
      address,
      'eyewear_basic',
    );
  }

  // Head / Hair
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

  // Accessories (max 2)
  const accessories: string[] = [];

  if (NFT >= 20) {
    const first = pickDeterministic(PATCHES, address, 'acc_patch1');
    accessories.push(first);
    if (accessories.length < 2) {
      const remaining = PATCHES.filter((p) => p !== first);
      accessories.push(
        pickDeterministic(remaining, address, 'acc_patch2'),
      );
    }
  } else if (NFT >= 1) {
    const first = pickDeterministic(PATCHES, address, 'acc_patch_single');
    accessories.push(first);
  }

  if (TX >= 1000 && accessories.length < 2) {
    accessories.push('wrist_band');
  }
  if (BAL >= 0.3 && accessories.length < 2) {
    accessories.push('thin_pendant');
  }
  if (UC >= 200 && accessories.length < 2) {
    accessories.push('comms_earpiece');
  }
  accessories.splice(2); // hard cap = 2

  // Emblem
  let emblem: string;
  if (RANK <= 25000) {
    emblem = 'chevron';
  } else {
    emblem = pickDeterministic(EMBLEM_OPTIONS, address, 'emblem');
  }

  // Detail level (0..5) از UC و GAS
  const ucNorm =
    UC > 0 ? Math.min(1, UC / BUCKET.UC[BUCKET.UC.length - 1]) : 0;
  const gasNorm =
    GAS > 0 ? Math.min(1, GAS / BUCKET.GAS[BUCKET.GAS.length - 1]) : 0;
  let detail = Math.floor(ucNorm * 3 + gasNorm * 2);
  detail = clamp(detail, 0, 5);

  // Background pastel: از MASTER_SEED و species قابل تغییر
  const masterSeed = Number(process.env.IMG_MASTER_SEED ?? '424242');
  const speciesIndex = Math.max(0, SPECIES.indexOf(species));
  const bgIndex =
    ((masterSeed + speciesIndex) % 12 + 12) % 12; // 0..11
  const bgPastelName = `pastel_${bgIndex}`;
  const bgPastelDesc = getSpeciesBackgroundColor(species);

  return {
    outfit,
    eyewear,
    head,
    accessories,
    emblem,
    detail,
    bgPastelName,
    bgPastelDesc,
  };
}

/* ------------------------ locked 3D prompt builder ------------------------ */

function buildLockedPromptMinimal(input: {
  species: string;
  tokens: string[];
  seed: number;
  visual: VisualTraits;
}) {
  const { species, tokens, seed, visual } = input;

  const tokensCsv =
    tokens && tokens.length ? tokens.join(', ') : 'none';

  const bodyColorDesc = getSpeciesBodyColor(species);
  const bgDesc = visual.bgPastelDesc;

  const STYLE = `Stylized minimal 3D cartoon, full-body standing character (head-to-toe visible), single subject,
square 1:1 frame, centered. Orthographic-like camera, mild perspective only. Matte materials, no PBR gloss.
Clean simple geometry, consistent edge thickness, soft ambient occlusion.
Studio-like solid pastel background (flat or very subtle radial), no scene clutter.`;

  const COLOR_RULES = `Color palette rules:
- The character body / fur / skin for this species is always rendered in blue-family tones: ${bodyColorDesc}.
- Do NOT use natural animal fur colors like brown, tan, beige, saturated orange or strong red for the body.
- Clothing colors are flexible like a normal character: you may use blues, greys, blacks and muted accent colors,
  but do not shift the body itself away from the blue/teal family.
- The background uses a soft pastel color based on the species: ${bgDesc}, clearly separated from the body color.`;

  const TRAITS = `Character: anthropomorphic ${species} representing a Base onchain wallet persona.
The base body silhouette, proportions, and pose for this species are locked and must remain consistent across all renders.

Use ONLY the following trait choices. Do NOT invent any item beyond them:

Outfit: ${visual.outfit} (matte).
Eyewear: ${visual.eyewear}.
Head/Hair: ${visual.head}.
Accessories (max 2 small items): ${
    visual.accessories.length ? visual.accessories.join(', ') : 'none'
  }.
Chest Emblem: ${visual.emblem} (small flat decal).
Detail Level: detail_${visual.detail} (0=plain … 5=soft circuit lines).
Background: ${visual.bgPastelName} — ${visual.bgPastelDesc}, single solid pastel color.`;

  const TOKENS = `On-chain intensity tokens (guides only, not new items): ${tokensCsv}.`;

  const FRAMING = `Framing constraints:
- Full body in frame (no crop), arms relaxed or subtle hero stance.
- No hands close-up, no extra props, no multiple characters, no text, no logos or watermarks.`;

  const CONTEXT = `Context: Base onchain wallet persona. Deterministic collection seed ${seed}.`;

  const prompt = `${STYLE}

${COLOR_RULES}

${TRAITS}

${TOKENS}

${FRAMING}

${CONTEXT}`.trim();

  const NEGATIVE = `natural animal fur colors, brown fur, tan fur, beige fur, saturated orange fur, red fur,
close-up, portrait, bust, half-body, cropped, photorealistic, PBR, glossy, raytraced reflections,
complex environment, multiple characters, hands close-up, text, logo, watermark, busy patterns,
film grain, harsh shadows, lens flare, heavy gradients, realistic skin, pores, gritty, horror, gore`;

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

  // اگر سایز خاصی خواستی، می‌تونی در آینده image_config هم اضافه کنی

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
    const img = msg?.images?.[0];
    const url: string | undefined =
      img?.image_url?.url || img?.imageUrl?.url || img?.url;

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

    const species = pickSpeciesByNibble(address);

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
    const addrHash = hashSeed(address!);

    const seed =
      seedMode === 'collection_xor_wallet'
        ? (masterSeed ^ addrHash) % 1_000_000_000
        : masterSeed;

    const visual = mapBucketsToVisualTraits(buckets, species, address!);

    const { prompt, negative } = buildLockedPromptMinimal({
      species,
      tokens,
      seed,
      visual,
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
