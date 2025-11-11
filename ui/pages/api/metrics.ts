// pages/api/metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'node:crypto';
import { fetchWalletJson, type WalletJson } from '../../lib/githubWallet';
import { genDemoPayload } from '../../lib/demoMetrics';

/** ---- types expected by WalletFrames / WalletMetrics ---- */
type Rank = { rank: number; pct: number; score?: number };
type Monthly = {
  month: string;
  ym: number;
  avg_balance_usd?: number;
  avg_balance_eth?: number;
  volume_usd?: number;
  swap_volume_usd?: number;
  bridge_volume_usd?: number;
  native_txs?: number;
  token_txs?: number;
  uniq_contracts?: number;
  uniq_days?: number;
  uniq_weeks?: number;
  nft_unique_contracts?: number;
  nft_holds_builder?: number;
  nft_holds_introduced?: number;
  tokens_traded_unique?: number;
  gas_spent_eth?: number;
  ranks?: {
    balance?: Rank;
    volume?: Rank;
    activity?: Rank;
    nft?: Rank;
    overall?: Rank & { score?: number };
  } | null;
};
type Summary = {
  current_streak_months?: number;
  best_streak_months?: number;
  active_months_total?: number;
  wallet_age_days?: number;
  cum_ranks?: {
    balance?: { rank: number; pct: number; bucket?: string };
    activity?: Rank;
    volume?: Rank;
    overall?: { score: number; rank: number; pct: number };
  } | null;
};
type Payload = { summary: Summary; monthly: Monthly[] };

const ymNum = (ymStr: string) => parseInt(ymStr.replace('-', ''), 10);

/** Adapter: GitHub JSON ➜ Payload expected by UI */
function adapt(doc: WalletJson): Payload {
  const monthsSorted = Object.keys(doc.months || {}).sort();
  const monthly: Monthly[] = monthsSorted.map((k) => {
    const m = doc.months[k] || {};
    const ym = ymNum(k);
    return {
      month: k,
      ym,
      avg_balance_eth: m.bal ?? 0,
      volume_usd: 0,
      swap_volume_usd: 0,
      bridge_volume_usd: 0,
      native_txs: m.txs ?? 0,
      token_txs: m.trade ?? 0,
      uniq_contracts: m.uniq ?? 0,
      uniq_days: m.days ?? 0,
      uniq_weeks: m.streak ?? 0, // Best Streak (days) within month
      nft_unique_contracts: m.nft ?? 0,
      gas_spent_eth: m.gas ?? 0,
      tokens_traded_unique: 0,
      ranks:
        m.rank_m != null || m.pct_m != null
          ? { overall: { rank: m.rank_m ?? 0, pct: m.pct_m ?? 0 } }
          : null,
    };
  });

  const lifetime = doc.lifetime ?? {};
  const activeMonthsFallback = monthsSorted.filter(k => {
    const m = doc.months[k];
    return !!(m?.txs || m?.uniq || m?.nft || m?.gas || m?.trade || m?.days);
  }).length;

  const summary: Summary = {
    active_months_total: lifetime.months_active ?? activeMonthsFallback,
    wallet_age_days: 0,
    current_streak_months: 0,
    best_streak_months: 0,
    cum_ranks: {
      overall: { score: 0, rank: doc.rank ?? 0, pct: 0 },
      balance: undefined,
      activity: undefined,
      volume: undefined,
    },
  };

  return { summary, monthly };
}

/** ---- tiny in-memory cache for demo responses (stable per address) ---- */
type CacheEntry = { json: string; etag: string; ts: number };
const demoCache = new Map<string, CacheEntry>();
const DEMO_TTL_MS = 5 * 60 * 1000;

function makeEtag(body: string) {
  return `"W/${crypto.createHash('sha1').update(body).digest('base64')}"`;
}
function getStableDemo(addressKey: string): CacheEntry {
  const now = Date.now();
  const cached = demoCache.get(addressKey);
  if (cached && now - cached.ts < DEMO_TTL_MS) return cached;

  // دمو را یک بار بساز و ثابت نگه دار (برای جلوگیری از پرش UI)
  const data = genDemoPayload(); // اگر خواستی: میشه بر اساس address seeding هم اضافه کرد
  const json = JSON.stringify(data);
  const etag = makeEtag(json);
  const entry = { json, etag, ts: now };
  demoCache.set(addressKey, entry);
  return entry;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const addressRaw = String(req.query.address || '').trim();
  const address = addressRaw.toLowerCase();
  const ifNoneMatch = req.headers['if-none-match'];

  const sendJSON = (json: string) => {
    // ETag + Cache headers
    const etag = makeEtag(json);
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=180, stale-while-revalidate=60');
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=180, stale-while-revalidate=60');
    return res.status(200).send(json);
  };

  const sendDemo = (key = 'demo') => {
    const demo = getStableDemo(key);
    res.setHeader('x-demo', '1');
    return sendJSON(demo.json);
  };

  try {
    // آدرس نامعتبر → دموِ ثابت
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      return sendDemo('demo');
    }

    // تلاش برای خواندن از GitHub
    const doc = await fetchWalletJson(address);
    const payload = adapt(doc);
    const json = JSON.stringify(payload);
    return sendJSON(json);
  } catch {
    // خطا → دموِ ثابت per-address (برای ثبات UI)
    return sendDemo(`demo:${address || 'none'}`);
  }
}
