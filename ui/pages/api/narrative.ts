// pages/api/narrative.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type PersonaIn = { persona?: any; traits?: any; address?: string };

function toHexSeed(addr?: string) {
  try {
    const a = (addr || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return 12345;
    return parseInt(a.slice(-8), 16) || 12345;
  } catch { return 12345; }
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rng: () => number, arr: T[]) => arr[Math.floor(rng() * arr.length)];

function normalizeArchetype(p?: any): 'Explorer'|'Builder'|'Generalist'|'Degen'|'Collector'|'Quiet' {
  const t = (p?.archetype || p?.traitsText?.[0] || '').toLowerCase();
  if (t.includes('degen')) return 'Degen';
  if (t.includes('builder') || (p?.tone === 'builderish')) return 'Builder';
  if (t.includes('collector')) return 'Collector';
  if (t.includes('explorer')) return 'Explorer';
  if (t.includes('generalist')) return 'Generalist';
  return 'Quiet';
}
function rankBand(p?: any): 'apex'|'elite'|'upper'|'mid'|'lower'|'fresh'|'unknown' {
  const band = (p?.rank?.band || '').toLowerCase();
  if (band.includes('apex')) return 'apex';
  if (band.includes('elite')) return 'elite';
  if (band.includes('trail') || band.includes('veteran')) return 'upper';
  if (band.includes('seasoned') || band.includes('explorer')) return 'mid';
  if (band.includes('casual')) return 'lower';
  if (band.includes('newcomer')) return 'fresh';
  return 'unknown';
}

// Base-flavored but non-visual lines (no visor/halo/art words)
function baseFlavorLines(rng: () => number) {
  const openers = [
    'Base is a builder’s chain—the kind where summers don’t end, they evolve.',
    'Some wallets shout; this one hums. On Base, that’s a signal.',
    'On Base, momentum is a craft. This wallet treats it like muscle memory.',
    'The Base crowd respects patience; this wallet learned that early.',
  ];
  const builderisms = [
    'keeps showing up after the noise fades',
    'treats progress like a steady habit',
    'follows a thesis, not every trend',
    'waits for clean entries instead of drama',
  ];
  const social = [
    'reads like someone who builds first and explains later',
    'feels at home in builder threads and quiet DMs',
    'maxxes quietly—less talk, more shipping',
  ];
  return {
    opener: pick(rng, openers),
    builder1: pick(rng, builderisms),
    builder2: pick(rng, builderisms),
    social: pick(rng, social),
  };
}

function craftStory(rng: () => number, arch: string, band: string) {
  const titles = {
    apex:   ['North-Star Runner', 'Apex Builder', 'Prime Signal'],
    elite:  ['Blue-Chip Tempo', 'Core Orbit', 'Prime Time'],
    upper:  ['Steady Trailblazer', 'Builder in Motion', 'Early Signal'],
    mid:    ['Halo Runner', 'Midfield Explorer', 'Quiet Voltage'],
    lower:  ['Sandbox Walker', 'Low-Freq Scout', 'Idle Dreamer'],
    fresh:  ['New Wave', 'First Steps', 'Onramp Soul'],
    unknown:['Onchain Native', 'Base-side Wanderer', 'Signal in Progress'],
  }[band || 'unknown'];

  const title = pick(rng, titles);
  const archetypeWord = arch === 'Quiet' ? 'Explorer' : arch;

  const oneLiners = [
    `${archetypeWord} energy with builder instincts.`,
    `Low noise, high signal—${archetypeWord.toLowerCase()} written in lowercase.`,
    `Not here to farm hype—here to find flow.`,
  ];
  const oneLiner = pick(rng, oneLiners);

  // ~140–180 words, human & shareable, no raw stats, no visual keywords
  const paragraph: string[] = [];
  const base = baseFlavorLines(rng);

  paragraph.push(`${base.opener} This wallet reads like someone who ${base.builder1}, and still ${base.builder2}.`);
  paragraph.push(`There’s a ${archetypeWord.toLowerCase()} streak here—curiosity without chaos, focus without fuss.`);
  paragraph.push(`When lines go parabolic, this one edits; when signals get quiet, it listens.`);
  paragraph.push(`It tends to arrive early and leave clean, like someone who values craft over noise.`);
  paragraph.push(`People on Base call that “builder timing”: not reckless, not timid—just present at the right moments.`);
  paragraph.push(`You can feel a sense of patience behind the moves—someone who tests, learns, then doubles down.`);
  paragraph.push(`If this were a friend, they’d be the calm one in the group chat, surfacing the link that actually matters.`);

  const highlights = [
    pick(rng, [
      'cadence: bursts, then breathers',
      'cadence: slow build, clean exits',
      'cadence: quiet most days, decisive on the right ones',
    ]),
    pick(rng, [
      'risk lens: measured; prefers asymmetric edges',
      'risk lens: playful, not reckless',
      'risk lens: thesis-first, timing-aware',
    ]),
    pick(rng, [
      'social cue: ship-first energy',
      'social cue: name-onchain > noise-offchain',
      'social cue: replies late, ships early',
    ]),
  ];

  return {
    title,
    oneLiner,
    summary: paragraph.join(' '),
    highlights,
    personalityTags: [],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { persona, address }: PersonaIn = req.body || {};
    const seed = toHexSeed(address);
    const rng = mulberry32(seed);

    const arch = normalizeArchetype(persona);
    const band = rankBand(persona);

    const story = craftStory(rng, arch, band);
    return res.status(200).json({ narrativeJson: story });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'narrative_failed' });
  }
}
