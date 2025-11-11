// pages/api/narrative.ts
import type { NextApiRequest, NextApiResponse } from 'next'

/* ---------- Types ---------- */
type Archetype = 'Explorer' | 'Builder' | 'Generalist' | 'Degen' | 'Collector' | 'Quiet'
type Band = 'apex' | 'elite' | 'upper' | 'mid' | 'lower' | 'fresh' | 'unknown'

type PersonaIn = {
  persona?: any
  traits?: any
  address?: string
}

/* ---------- Utils ---------- */
function toHexSeed(addr?: string) {
  try {
    const a = (addr || '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(a)) return 0xdeadbeef
    return parseInt(a.slice(-8), 16) || 0xdeadbeef
  } catch { return 0xdeadbeef }
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[], fallback: T): T {
  if (!arr || arr.length === 0) return fallback
  return arr[Math.floor(rng() * arr.length)]
}

function normalizeArchetype(p?: any): Archetype {
  const t = String(p?.archetype || p?.traitsText?.[0] || p?.tone || '').toLowerCase()
  if (t.includes('degen')) return 'Degen'
  if (t.includes('builder')) return 'Builder'
  if (t.includes('collector')) return 'Collector'
  if (t.includes('explorer')) return 'Explorer'
  if (t.includes('generalist')) return 'Generalist'
  return 'Quiet'
}

function rankBand(p?: any): Band {
  const band = String(p?.rank?.band || '').toLowerCase()
  if (band.includes('apex')) return 'apex'
  if (band.includes('elite')) return 'elite'
  if (band.includes('trail') || band.includes('veteran')) return 'upper'
  if (band.includes('seasoned') || band.includes('explorer')) return 'mid'
  if (band.includes('casual')) return 'lower'
  if (band.includes('newcomer')) return 'fresh'
  return 'unknown'
}

/* ---------- Base-flavored lines (no visual words) ---------- */
function baseFlavorLines(rng: () => number) {
  const openers = [
    'On Base, summer doesn’t end—tempo just shifts.',
    'Some wallets shout; this one hums on purpose.',
    'Base is for builders; this one ships quietly.',
    'Low noise, high signal—that’s the brand.',
  ] as const

  const builderisms = [
    'keeps showing up when others log off',
    'has that “push to prod” calm',
    'treats the chain like a canvas, not a scoreboard',
    'spots the next thing early, waits for the right moment',
  ] as const

  const social = [
    'feels like an Onchain-Summer regular without needing the spotlight',
    'believes identity should be onchain (names first, drama later)',
    'maxxes quietly—less talk, more shipping',
    'carries “everyone can build” energy',
  ] as const

  return {
    opener: pick(rng, openers, openers[0]),
    builder1: pick(rng, builderisms, builderisms[0]),
    builder2: pick(rng, builderisms, builderisms[1]),
    social: pick(rng, social, social[0]),
  }
}

/* ---------- Soft animal metaphor (not tied to image/art) ---------- */
function animalMetaphor(rng: () => number, arch: Archetype, band: Band) {
  const pools: Record<'Quick'|'Calm'|'Bold'|'Craft', readonly string[]> = {
    Quick: ['fox', 'swallow', 'otter'],
    Calm:  ['owl', 'turtle', 'whale calf'],
    Bold:  ['falcon', 'wolverine', 'orca'],
    Craft: ['beaver', 'spider', 'ant'],
  }
  let bucket: 'Quick'|'Calm'|'Bold'|'Craft' = 'Calm'
  if (arch === 'Degen') bucket = 'Bold'
  else if (arch === 'Builder' || arch === 'Generalist') bucket = 'Craft'
  else if (arch === 'Explorer') bucket = 'Quick'
  if (band === 'apex' || band === 'elite') bucket = 'Bold'
  return pick(rng, pools[bucket], pools.Calm[0])
}

/* ---------- Story builder ---------- */
const TITLES: Record<Band, readonly string[]> = {
  apex:   ['Base Apex', 'Ship-First Apex', 'North-Star Runner'],
  elite:  ['Blue-Chip Tempo', 'Core Builder', 'Prime Time'],
  upper:  ['Steady Trailblazer', 'Builder in Motion', 'Early Signal'],
  mid:    ['Halo Runner', 'Midfield Explorer', 'Quiet Voltage'],
  lower:  ['Sandbox Walker', 'Low-Freq Scout', 'Idle Dreamer'],
  fresh:  ['New Wave', 'First Steps', 'On-ramp Soul'],
  unknown:['Onchain Native', 'Base-side Wanderer', 'Signal in Progress'],
}

function craftStory(rng: () => number, arch: Archetype, band: Band) {
  const baseLines = baseFlavorLines(rng)
  const title = pick(rng, TITLES[band], 'Base Native')
  const archetypeWord = arch === 'Quiet' ? 'Explorer' : arch
  const animal = animalMetaphor(rng, arch, band)

  const oneLiners = [
    `${archetypeWord} energy with builder instincts.`,
    `Low noise, high signal—${archetypeWord.toLowerCase()} in lowercase.`,
    `Not here to farm hype—here to find flow.`,
  ] as const
  const oneLiner = pick(rng, oneLiners, oneLiners[0])

  const para: string[] = []
  para.push(`${baseLines.opener} Reads like someone who ${baseLines.builder1}, and still ${baseLines.builder2}.`)
  para.push(`There’s a ${archetypeWord.toLowerCase()} streak here—curiosity without the chaos, focus without the fuss.`)
  para.push(`When markets shout, this one edits. When opportunities whisper, it listens.`)
  para.push(`You notice it twice: once on arrival, and once when the merge request lands.`)
  para.push(`Not a loud maxxer, more of a patient one; ${baseLines.social}.`)
  para.push(`If you needed a spirit-guide, call it a ${animal}: small moves, smart timing, long memory.`)
  para.push(`Feels very Base—“ship > shout”, names onchain, and a belief that better apps beat louder threads.`)

  const highlights = [
    pick(rng, [
      'cadence: bursts, then breathers',
      'cadence: slow build, clean exits',
      'cadence: quiet most days, decisive on the right ones',
    ], 'cadence: bursts, then breathers'),
    pick(rng, [
      'risk: measured curiosity',
      'risk: playful, not reckless',
      'risk: thesis-first, timing-aware',
    ], 'risk: measured curiosity'),
    pick(rng, [
      'social: ship > shout',
      'social: name-first, chain-first',
      'social: replies late, ships early',
    ], 'social: ship > shout'),
  ]

  return {
    title,
    oneLiner,
    summary: para.join(' '),
    highlights,
    personalityTags: [], // no tags per your preference
  }
}

/* ---------- API handler ---------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  try {
    const { persona, address }: PersonaIn = req.body || {}
    const seed = toHexSeed(address)
    const rng = mulberry32(seed)

    const arch = normalizeArchetype(persona)
    const band = rankBand(persona)
    const story = craftStory(rng, arch, band)

    return res.status(200).json({ narrativeJson: story })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'narrative_failed' })
  }
}
