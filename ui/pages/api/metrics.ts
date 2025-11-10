import type { NextApiRequest, NextApiResponse } from 'next'

type Rank = { rank:number; pct:number; score?:number }
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
  ranks?: { balance?: Rank; volume?: Rank; activity?: Rank; nft?: Rank; overall?: Rank } | null
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

const OWNER =
  process.env.WCDN_OWNER ||
  process.env.NEXT_PUBLIC_WCDN_OWNER ||
  'zeinabshahi'

function repoFor(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, '')
  const first = a[0] || '0'
  return `wallets-${first}`
}
function pathFor(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, '')
  const pfx = a.slice(0, 2)
  return `${pfx}/0x${a}.json`
}

async function fetchWallet(addr: string) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${repoFor(addr)}/main/${pathFor(addr)}`
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`cdn 404: ${url}`)
  return r.json()
}

// GitHub wallet doc → Payload موردنیاز کامپوننت‌ها
function adapt(doc: any): Payload {
  const months = Object.keys(doc?.months || {}).sort()
  const monthly: Monthly[] = months.map((ym) => {
    const m = doc.months[ym] || {}
    return {
      month: ym,
      ym: parseInt(ym.replace('-', ''), 10),
      avg_balance_eth: Number(m.bal ?? 0),
      volume_usd: 0,
      native_txs: Number(m.txs ?? 0),
      token_txs: 0,
      uniq_contracts: Number(m.uniq ?? 0),
      uniq_days: Number(m.days ?? 0),
      uniq_weeks: 0,
      nft_unique_contracts: Number(m.nft ?? 0),
      gas_spent_eth: Number(m.gas ?? 0),
      ranks: (m.rank_m!=null || m.pct_m!=null)
        ? { overall: { rank: Number(m.rank_m ?? 0), pct: Number(m.pct_m ?? 0) } as any }
        : null
    }
  })

  const best_streak_days = Number(doc?.lifetime?.streak_best_days ?? 0)
  const summary: Summary = {
    current_streak_months: 0,
    best_streak_months: Math.round(best_streak_days / 30),
    active_months_total: Number(doc?.lifetime?.months_active ?? months.length),
    wallet_age_days: 0,
    cum_ranks: { overall: { score: 0, rank: Number(doc?.rank ?? 0), pct: 0 } }
  }
  return { summary, monthly }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const address = String(req.query.address || '').toLowerCase()
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      res.status(400).json({ error: 'address is required' }); return
    }
    const doc = await fetchWallet(address)
    const payload = adapt(doc)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
    res.status(200).json(payload)
  } catch (e: any) {
    res.status(404).json({ error: e?.message || 'not found' })
  }
}
