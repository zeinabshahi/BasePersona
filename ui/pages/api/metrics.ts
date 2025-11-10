// pages/api/metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next'

type WalletDoc = {
  wallet: string
  rank: number
  lifetime: {
    months_active: number
    first: string
    last: string
    tx_sum: number
    uniq_sum: number
    trade_sum: number
    nft_sum: number
    gas_sum: number
    avg_balance_eth_mean: number
    streak_best_days: number
  }
  months: Record<string, {
    txs?: number
    uniq?: number
    trade?: number
    nft?: number
    gas?: number
    bal?: number
    days?: number
    spread?: number
    streak?: number
    rank_m?: number
    pct_m?: number
    gas_method?: string
  }>
}

function ymNum(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return (y || 0) * 100 + (m || 0)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = String(req.query.address || '').toLowerCase()
  if (!address) return res.status(400).json({ error: 'missing address' })

  // مستقیماً از روت wcdn خودمان بخوان
  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`
  const r = await fetch(`${origin}/api/wcdn/${address}`)
  if (!r.ok) return res.status(r.status).json({ error: `wcdn ${r.status}` })

  const doc = (await r.json()) as WalletDoc
  const monthsKeys = Object.keys(doc.months || {}).sort()

  const monthly = monthsKeys.map((k) => {
    const m = doc.months[k] || {}
    return {
      month: k,                      // "2024-04"
      ym: ymNum(k),                  // 202404
      avg_balance_usd: undefined,
      avg_balance_eth: m.bal ?? 0,
      volume_usd: 0,                 // در سورس موجود نیست → صفر
      swap_volume_usd: 0,
      bridge_volume_usd: 0,
      native_txs: m.txs ?? 0,        // کل txs را فعلاً native درنظر می‌گیریم
      token_txs: 0,
      uniq_contracts: m.uniq ?? 0,
      uniq_days: m.days ?? 0,
      uniq_weeks: 0,
      nft_unique_contracts: m.nft ?? 0,
      nft_holds_builder: undefined,
      nft_holds_introduced: undefined,
      tokens_traded_unique: 0,
      gas_spent_eth: m.gas ?? 0,
      ranks: {
        overall: (m.rank_m != null || m.pct_m != null)
          ? { rank: m.rank_m ?? 0, pct: m.pct_m ?? 0, score: 0 }
          : undefined,
        // بقیه rankها دیتای مستقیمی ندارند
      }
    }
  })

  const summary = {
    current_streak_months: (() => {
      const last = monthsKeys[monthsKeys.length - 1]
      return last ? (doc.months[last]?.streak ?? 0) : 0 // واحد: روز
    })(),
    best_streak_months: doc.lifetime?.streak_best_days ?? 0, // واحد: روز
    active_months_total: doc.lifetime?.months_active ?? monthsKeys.length,
    wallet_age_days: undefined, // اگر لازم شد می‌تونیم از first/now تخمین بزنیم
    cum_ranks: {
      balance: { rank: doc.rank ?? 0, pct: 0, bucket: undefined },
      activity: undefined,
      volume: undefined,
      overall: { score: 0, rank: doc.rank ?? 0, pct: 0 }
    }
  }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
  return res.status(200).json({ summary, monthly })
}
