import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Calculate a persona based on input metrics. The logic here is simplistic and
 * deterministic; adjust the thresholds and formulas according to your
 * application requirements. All returned fields must be bounded as described
 * in the Master Project Prompt.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { metrics } = req.body as { metrics: any };
    if (!metrics) {
      res.status(400).json({ error: 'Missing metrics' });
      return;
    }
    // Determine wealth tier based on volume (log scale). Basic buckets.
    const vol = Number(metrics.volumeETH) || 0;
    let wealthTier = 0;
    if (vol > 1000) wealthTier = 4;
    else if (vol > 100) wealthTier = 3;
    else if (vol > 10) wealthTier = 2;
    else if (vol > 1) wealthTier = 1;
    // Mood is neutral by default; you may derive from recent activity
    const mood: 'happy' | 'neutral' | 'serious' = 'neutral';
    // Body type (stylistic only) defaults to average
    const bodyType: 'slim' | 'average' | 'athletic' | 'stocky' = 'average';
    // Archetype based on activity patterns
    let archetype: 'dormant' | 'hodler' | 'trader' | 'nft_collector' | 'airdrop_hunter' | 'balanced' = 'balanced';
    const txCount = Number(metrics.txCount) || 0;
    const dexTrades = Number(metrics.dexTrades) || 0;
    const nftMints = Number(metrics.nftMints) || 0;
    if (txCount < 3) {
      archetype = 'dormant';
    } else if (dexTrades > txCount / 2) {
      archetype = 'trader';
    } else if (nftMints > txCount / 2) {
      archetype = 'nft_collector';
    } else {
      archetype = 'balanced';
    }
    const personaJson = {
      wealthTier,
      mood,
      bodyType,
      archetype,
    };
    res.status(200).json({ personaJson });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
