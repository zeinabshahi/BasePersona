import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchWalletJson, type WalletJson } from '../../lib/githubWallet'

/** ---- types expected by WalletFrames (بدون تغییر UI) ---- */
type Rank = { rank:number; pct:number, score?:number }
type Monthly = {
  month: string
  ym: number
  avg_balance_usd?: number
  avg_balance_eth?: number
  volume_usd?: number
  swap_volume_usd?: number
  bridge_volume_usd?: number
  native_txs?: number
  token_txs?: number
  uniq_contracts?: number
  uniq_days?: number
  uniq_weeks?: number
  nft_unique_contracts?: number
  nft_holds_builder?: number
  nft_holds_introduced?: number
  tokens_traded_unique?: number
  gas_spent_eth?: number
  ranks?: {
    balance?: Rank
    volume?: Rank
    activity?: Rank
    nft?: Rank
    overall?: Rank
  } | null
}
type Summary = {
  current_streak_months?: number
  best_streak_months?: number
  active_months_total?: number
  wallet_age_days?: number
  cum_ranks?: {
    balance?: { rank:number; pct:number; bucket?:string }
    activity?: Rank
    volume?: Rank
    overall?: { score:number; rank:number; pct:number }
  } | null
}
type Payload = { summary: Summary; monthly: Monthly[] }

/** helpers */
const ymNum = (ymStr: string) => parseInt(ymStr.replace('-', ''), 10);

/** Adapter: GitHub JSON ➜ Payload expected by WalletFrames */
function adapt(doc: WalletJson): Payload {
  const monthsSorted = Object.keys(doc.months || {}).sort(); // "2024-04" ...
  const monthly: Monthly[] = monthsSorted.map((k) => {
    const m = doc.months[k] || {};
    const ym = ymNum(k);
    return {
      month: k,
      ym,
      avg_balance_eth: m.bal ?? 0,
      // USD/volume جزئیات نداریم؛ صفر می‌گذاریم که UI قبلی به‌هم نریزد
      volume_usd: 0,
      swap_volume_usd: 0,
      bridge_volume_usd: 0,
      native_txs: m.txs ?? 0,
      token_txs: 0,
      uniq_contracts: m.uniq ?? 0,
      uniq_days: m.days ?? 0,
      uniq_weeks: 0,
      nft_unique_contracts: m.nft ?? 0,
      gas_spent_eth: m.gas ?? 0,
      tokens_traded_unique: 0,
      // ماهانه فقط overall داریم
      ranks: {
        overall: (m.rank_m != null || m.pct_m != null)
          ? { rank: m.rank_m ?? 0, pct: m.pct_m ?? 0 }
          : undefined
      }
    };
  });

  const lifetime = doc.lifetime ?? {};
  const summary: Summary = {
    active_months_total: lifetime.months_active ?? monthsSorted.filter(k => {
      const m = doc.months[k];
      return !!(m?.txs || m?.uniq || m?.nft || m?.gas);
    }).length,
    wallet_age_days: 0,                     // اگر لازم بود بعداً دقیق محاسبه می‌کنیم
    current_streak_months: 0,               // در دادهٔ شما streak روزانه است
    best_streak_months: 0,
    cum_ranks: {
      overall: {
        score: 0,
        rank: doc.rank ?? 0,
        pct: 0
      },
      balance: undefined,
      activity: undefined,
      volume: undefined,
    }
  };

  return { summary, monthly };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const addressRaw = String(req.query.address || '').trim();
    const address = addressRaw.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      res.status(400).json({ error: 'bad address' }); return;
    }

    // 1) از GitHub بخوان
    const doc = await fetchWalletJson(address);

    // 2) تبدیل به ساختار مورد نیاز فریم‌ها
    const payload = adapt(doc);

    // 3) پاسخ
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    res.status(200).json(payload);
  } catch (e: any) {
    res.status(404).json({ error: e?.message || 'not found' });
  }
}
