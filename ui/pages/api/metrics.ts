// pages/api/metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWalletJson, type WalletJson } from '../../lib/githubWallet';

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

  native_txs?: number;           // txs
  token_txs?: number;            // trade
  uniq_contracts?: number;       // uniq
  uniq_days?: number;            // days
  uniq_weeks?: number;           // streak (days, within month)

  nft_unique_contracts?: number; // nft
  nft_holds_builder?: number;
  nft_holds_introduced?: number;

  tokens_traded_unique?: number; // not present in source; keep 0
  gas_spent_eth?: number;        // gas

  ranks?: {
    balance?: Rank;
    volume?: Rank;
    activity?: Rank;
    nft?: Rank;
    overall?: Rank;
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

/** helpers */
const ymNum = (ymStr: string) => parseInt(ymStr.replace('-', ''), 10);

/** Adapter: GitHub JSON ➜ Payload expected by UI */
function adapt(doc: WalletJson): Payload {
  const monthsSorted = Object.keys(doc.months || {}).sort(); // "2024-04", ...
  const monthly: Monthly[] = monthsSorted.map((k) => {
    const m = doc.months[k] || {};
    const ym = ymNum(k);
    return {
      month: k,
      ym,

      // balance
      avg_balance_eth: m.bal ?? 0,

      // volume placeholders (UI قدیمی به USD نیازی نداشت)
      volume_usd: 0,
      swap_volume_usd: 0,
      bridge_volume_usd: 0,

      // activity
      native_txs: m.txs ?? 0,           // Transactions
      token_txs: m.trade ?? 0,          // Trades (count)
      uniq_contracts: m.uniq ?? 0,      // Unique Contracts
      uniq_days: m.days ?? 0,           // Active Days
      uniq_weeks: m.streak ?? 0,        // Best Streak (days) within the month

      // nft & gas
      nft_unique_contracts: m.nft ?? 0,
      gas_spent_eth: m.gas ?? 0,

      // not available in source; keep 0 to not break UI
      tokens_traded_unique: 0,

      // monthly rank
      ranks: (m.rank_m != null || m.pct_m != null)
        ? { overall: { rank: m.rank_m ?? 0, pct: m.pct_m ?? 0 } }
        : { overall: undefined },
    };
  });

  const lifetime = doc.lifetime ?? {};
  const summary: Summary = {
    active_months_total:
      lifetime.months_active ??
      monthsSorted.filter(k => {
        const m = doc.months[k];
        return !!(m?.txs || m?.uniq || m?.nft || m?.gas || m?.trade || m?.days);
      }).length,

    // در دادهٔ فعلی «سن والت به روز» نداریم؛ اگر لازم شد بعداً از first/last محاسبه می‌کنیم
    wallet_age_days: 0,

    // streak‌های ما ماهانه نیست؛ best streak روزانه در lifetime اگر لازم شد می‌توان نشان داد
    current_streak_months: 0,
    best_streak_months: 0,

    // رتبهٔ تجمیعی (اختیاری برای کارت‌های جدید)
    cum_ranks: {
      overall: {
        score: 0,
        rank: doc.rank ?? 0,
        pct: 0,
      },
      balance: undefined,
      activity: undefined,
      volume: undefined,
    },
  };

  return { summary, monthly };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const addressRaw = String(req.query.address || '').trim();
    const address = addressRaw.toLowerCase();

    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      res.status(400).json({ error: 'bad address' });
      return;
    }

    // 1) خواندن از GitHub (ریپوهای wallets-<nibble>)
    const doc = await fetchWalletJson(address);

    // 2) تبدیل به ساختار موردنیاز UI
    const payload = adapt(doc);

    // 3) پاسخ با کش لبه
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    res.status(200).json(payload);
  } catch (e: any) {
    res.status(404).json({ error: e?.message || 'not found' });
  }
}
