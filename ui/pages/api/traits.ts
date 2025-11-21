// pages/api/traits.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pickSpeciesByNibble, type SpeciesId } from '../../lib/species';

/* ---------------- Helpers ---------------- */

function isAddr(s?: string) {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(String(s));
}

/* -------- same buckets as /api/generate.ts -------- */

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

// Rank: smaller is better ⇒ smallest ceiling >= v
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

/* ---------------- API handler ---------------- */

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
    const { address, metrics = {} } = (req.body || {}) as {
      address?: string;
      metrics?: any;
    };

    if (!isAddr(address)) {
      return res
        .status(400)
        .json({ ok: false, error: 'bad_address' });
    }

    const addr = address as string;
    const species: SpeciesId = pickSpeciesByNibble(addr);

    // ورودی‌های مختلف را normalize می‌کنیم
    const raw: RawTraits = {
      uniqueContracts: Number(
        metrics.uniqueContracts ??
          metrics.uniqContracts ??
          metrics.unique_contracts ??
          0,
      ),
      activeDays: Number(
        metrics.activeDays ??
          metrics.uniqDays ??
          metrics.active_days ??
          0,
      ),
      gasPaidEth: Number(
        metrics.gasPaidEth ??
          metrics.gasEth ??
          metrics.gas_eth ??
          metrics.gas ??
          0,
      ),
      monthlyRank: Number(
        metrics.monthlyRank ??
          metrics.rank ??
          metrics.global_rank ??
          500000,
      ),
      nftCount: Number(
        metrics.nftCount ??
          metrics.nftMints ??
          metrics.nft_mints ??
          0,
      ),
      balanceEth: Number(
        metrics.balanceEth ??
          metrics.balanceEthMean ??
          metrics.avg_balance_eth ??
          0,
      ),
      txCount: Number(
        metrics.txCount ??
          metrics.totalTxs ??
          metrics.total_txs ??
          metrics.txs ??
          0,
      ),
    };

    const { buckets, tokens } = toBucketsAndTokens(raw);

    const traitsJson = {
      species,
      raw,
      buckets,
      tokens,
    };

    return res.status(200).json({
      ok: true,
      address: addr,
      species,
      traitsJson,
    });
  } catch (e: any) {
    console.error('[api/traits] fatal:', e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'traits_failed' });
  }
}
