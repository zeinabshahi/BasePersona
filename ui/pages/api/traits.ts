import type { NextApiRequest, NextApiResponse } from 'next';
import { canonicalJson, toKeccakHex } from '../../lib/utils';

/**
 * Generate a traits JSON based on persona, metrics, timeAnchor and address. This
 * function implements simple heuristics for tier, stage and age mapping. Feel
 * free to refine these rules to better reflect your scoring model and
 * percentile calculations.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { persona, metrics, timeAnchor, address } = req.body as {
      persona: any;
      metrics: any;
      timeAnchor: any;
      address: string;
    };
    if (!persona || !metrics || !timeAnchor || !address) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }
    // Extract numeric metrics with safe defaults
    const txCount = Number(metrics.txCount) || 0;
    const volumeETH = Number(metrics.volumeETH) || 0;
    const uniqueContracts = Number(metrics.uniqueContracts) || 0;
    const activeDays = Number(metrics.activeDays) || 0;
    const dexTrades = Number(metrics.dexTrades) || 0;
    const nftMints = Number(metrics.nftMints) || 0;
    const firstSeenBlock = Number(metrics.firstSeenBlock) || 0;
    // Compute simple score without recency penalty
    const score =
      0.30 * Math.log1p(txCount) +
      0.25 * Math.log1p(volumeETH) +
      0.15 * uniqueContracts +
      0.15 * activeDays +
      0.10 * dexTrades +
      0.05 * nftMints;
    // Determine tier based on score. Adjust thresholds for your cohort distribution.
    let tier = 0;
    if (score > 4) tier = 4;
    else if (score > 3) tier = 3;
    else if (score > 2) tier = 2;
    else if (score > 1) tier = 1;
    // Determine stage based on transaction count
    let stage:
      | 'prelife_sperm'
      | 'embryo'
      | 'newborn'
      | 'child'
      | 'teen'
      | 'adult'
      | 'elder_powerful' = 'adult';
    if (txCount === 0) stage = 'prelife_sperm';
    else if (txCount < 5) stage = 'embryo';
    else if (txCount < 10) stage = 'newborn';
    else if (txCount < 20) stage = 'child';
    else if (txCount < 50) stage = 'teen';
    else if (txCount < 100) stage = 'adult';
    else stage = 'elder_powerful';
    // Tenure → age mapping
    const baseLaunch = new Date('2023-08-09T00:00:00Z').getTime() / 1000;
    const nowUnix = Number(timeAnchor.nowUnix) || Math.floor(Date.now() / 1000);
    const diffDays = Math.max(Math.floor((nowUnix - baseLaunch) / 86400), 1);
    const tenureRefDays = Math.min(Math.max(diffDays, 600), 900);
    // Approximate days on base; fall back to diffDays if firstSeenBlock is unknown
    let daysOnBase = diffDays;
    if (timeAnchor.blockNumber && firstSeenBlock && timeAnchor.blockNumber > firstSeenBlock) {
      // Rough estimate: assume average 3k blocks per day (not accurate)
      const deltaBlocks = timeAnchor.blockNumber - firstSeenBlock;
      daysOnBase = Math.max(Math.floor(deltaBlocks / 3000), 1);
    }
    let ageYears = Math.round((daysOnBase * (48 / tenureRefDays)));
    ageYears = Math.max(18, Math.min(ageYears, 48));
    let ageBand: 'young' | 'adult' | 'mature_elite' = 'adult';
    if (ageYears <= 24) ageBand = 'young';
    else if (ageYears <= 34) ageBand = 'adult';
    else ageBand = 'mature_elite';
    // Enforce elder_powerful stage constraints
    if (stage === 'elder_powerful') {
      ageBand = 'mature_elite';
      if (ageYears < 40) ageYears = 40;
    }
    // Compute seed from address and statsHash (if provided later). Use address only here.
    const seedInput = address.toLowerCase();
    const seedHex = toKeccakHex(seedInput);
    const seedNum = BigInt(seedHex);
    const paletteId = Number(seedNum % 4n);
    const faceId = Number((seedNum / 4n) % 5n);
    const clothesId = Number((seedNum / 20n) % 5n);
    // Determine OG badge based on early firstSeenBlock (arbitrary cutoff)
    const ogCutoff = 100_000;
    const og = firstSeenBlock > 0 && firstSeenBlock <= ogCutoff;
    const traitsJson: any = {
      version: 1,
      seed: seedHex,
      tier,
      stage,
      ageYears,
      ageBand,
      paletteId,
      faceId,
      clothesId,
      accessories: [],
      badges: { og },
      persona,
      styleLock: { camera: 'bust_3q', bg: 'brand_orb_v1' },
      score,
      timeAnchor,
    };
    const canonical = canonicalJson(traitsJson);
    const traitsHash = toKeccakHex(canonical);
    res.status(200).json({ traitsJson, traitsHash });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
