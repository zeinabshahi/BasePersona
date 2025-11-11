// pages/api/traits.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { canonicalJson, toKeccakHex } from '../../lib/utils'
import { pickSpeciesByNibble, type SpeciesId } from '../../lib/species'

type MetricsIn = {
  txCount?: number
  volumeETH?: number
  uniqueContracts?: number
  activeDays?: number
  dexTrades?: number
  nftMints?: number
  firstSeenBlock?: number
}

type BodyIn = {
  address: string
  persona?: any
  metrics?: MetricsIn
  timeAnchor?: { nowUnix?: number; blockNumber?: number }
}

function toSeedNum(addr: string): bigint {
  try {
    const h = toKeccakHex(addr.toLowerCase())
    return BigInt(h)
  } catch {
    return 0xdeadn
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  try {
    const { address, metrics, timeAnchor }: BodyIn = req.body || {}
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'invalid_address' })
    }

    // ---- core inputs (with safe defaults)
    const txCount        = Number(metrics?.txCount        ?? 0)
    const volumeETH      = Number(metrics?.volumeETH      ?? 0)
    const uniqueContracts= Number(metrics?.uniqueContracts?? 0)
    const activeDays     = Number(metrics?.activeDays     ?? 0)
    const dexTrades      = Number(metrics?.dexTrades      ?? 0)
    const nftMints       = Number(metrics?.nftMints       ?? 0)
    const firstSeenBlock = Number(metrics?.firstSeenBlock ?? 0)

    // ---- simple score (for tier if you need it later; not used by prompt)
    const score =
      0.30 * Math.log1p(txCount) +
      0.25 * Math.log1p(volumeETH) +
      0.15 * uniqueContracts +
      0.15 * activeDays +
      0.10 * dexTrades +
      0.05 * nftMints

    let tier = 0
    if (score > 4) tier = 4
    else if (score > 3) tier = 3
    else if (score > 2) tier = 2
    else if (score > 1) tier = 1

    // ---- age band estimate (optional)
    const baseLaunch = new Date('2023-08-09T00:00:00Z').getTime() / 1000
    const nowUnix = Number(timeAnchor?.nowUnix) || Math.floor(Date.now() / 1000)
    const diffDays = Math.max(Math.floor((nowUnix - baseLaunch) / 86400), 1)
    let daysOnBase = diffDays
    if (timeAnchor?.blockNumber && firstSeenBlock && timeAnchor.blockNumber > firstSeenBlock) {
      const deltaBlocks = timeAnchor.blockNumber - firstSeenBlock
      daysOnBase = Math.max(Math.floor(deltaBlocks / 3000), 1) // rough
    }
    let ageYears = Math.max(18, Math.min(Math.round(daysOnBase * (48 / Math.min(Math.max(diffDays, 600), 900))), 48))
    let ageBand: 'young' | 'adult' | 'mature_elite' = ageYears <= 24 ? 'young' : ageYears <= 34 ? 'adult' : 'mature_elite'

    // ---- deterministic species from address nibble
    const species: SpeciesId = pickSpeciesByNibble(address)

    // ---- deterministic cosmetic ids from address hash
    const seedNum = toSeedNum(address)
    const paletteId = Number(seedNum % 4n)
    const faceId    = Number((seedNum / 4n) % 5n)
    const clothesId = Number((seedNum / 20n) % 5n)

    // ---- HARD style lock (UI expects styleLock.bg === 'brand_orb_v1')
    const styleLock = {
      camera: 'bust_3q',                 // locked camera
      bg: 'brand_orb_v1',                // matches UI check in buildLockedPrompt
      lighting: 'cinematic studio lighting', // optional, but helpful
    }

    const traitsJson = {
      version: 2,
      address: address.toLowerCase(),
      species,                // <- used by prompt builder
      tier,
      ageYears,
      ageBand,
      paletteId,
      faceId,
      clothesId,
      styleLock,              // <- UI reads styleLock.bg & lighting
      score,
      metrics: { txCount, volumeETH, uniqueContracts, activeDays, dexTrades, nftMints },
      timeAnchor: { nowUnix },
    }

    const canonical = canonicalJson(traitsJson)
    const traitsHash = toKeccakHex(canonical)

    // two shapes so callers can use either `.traitsJson` or flat fields
    return res.status(200).json({ traitsJson, traitsHash, ...traitsJson })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'traits_failed' })
  }
}
