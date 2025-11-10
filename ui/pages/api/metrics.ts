import type { NextApiRequest, NextApiResponse } from 'next'

const GH_USER  = process.env.WALLETS_GH_USER  || 'zeinabshahi'
const BRANCH   = process.env.WALLETS_GH_BRANCH || 'main'

/** 0x63... -> { nibble:'6', pre2:'63', lower:'0x..' } */
function splitAddr(addr: string) {
  const orig = String(addr || '')
  const lower = orig.toLowerCase()
  if (!lower.startsWith('0x') || lower.length < 5) throw new Error('bad address')
  return { nibble: lower[2], pre2: lower.slice(2, 4), lower, orig }
}

/** سعی کن raw → اگر نبود jsDelivr → اگر نبود GitHub API (rate-limit کمتر) */
async function fetchWalletJson(user: string, repo: string, path: string, branch: string) {
  const raw = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`
  let r = await fetch(raw, { headers: { Accept: 'application/json' } })
  if (r.ok) return r

  const cdn = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`
  r = await fetch(cdn, { headers: { Accept: 'application/json' } })
  if (r.ok) return r

  const api = `https://api.github.com/repos/${user}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
  r = await fetch(api, { headers: { Accept: 'application/vnd.github.raw+json' } })
  return r
}

/** yyyy-mm -> yyyymm */
function ymNum(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return (y || 0) * 100 + (m || 0)
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = String(req.query.address || '')
    if (!q) return res.status(400).json({ error: 'missing address' })

    const { nibble, pre2, lower, orig } = splitAddr(q)
    const repo = `wallets-${nibble}`          // wallets-6 | wallets-b | ...
    const pathLower = `${pre2}/${lower}.json` // 63/0x63....json

    // 1) تلاش با lowercase کامل
    let r = await fetchWalletJson(GH_USER, repo, pathLower, BRANCH)

    // 2) اگر فایل در ریپو با حروفِ کیس‌مخلوط ذخیره شده بود، با همون ورودی خام هم تست کن
    if (!r.ok) {
      const pathOrig = `${orig.slice(2,4)}/${orig}.json`
      r = await fetchWalletJson(GH_USER, repo, pathOrig, BRANCH)
    }
    if (!r.ok) {
      return res.status(404).json({ error: `wallet doc not found (${repo}/${pathLower})` })
    }

    const doc = (await r.json()) as WalletDoc
    const keys = Object.keys(doc.months || {}).sort()

    const monthly = keys.map(k => {
      const m = doc.months[k] || {}
      return {
        month: k,
        ym: ymNum(k),
        avg_balance_usd: undefined,
        avg_balance_eth: m.bal ?? 0,
        volume_usd: 0,
        swap_volume_usd: 0,
        bridge_volume_usd: 0,
        native_txs: m.txs ?? 0,
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
          overall: (m.rank_m!=null || m.pct_m!=null)
            ? { rank: m.rank_m ?? 0, pct: m.pct_m ?? 0, score: 0 }
            : undefined,
          balance: undefined,
          volume: undefined,
          activity: undefined,
          nft: undefined,
        }
      }
    })

    const summary = {
      current_streak_months: (() => {
        const last = keys[keys.length - 1]
        return last ? (doc.months[last]?.streak ?? 0) : 0 // «روز» است؛ برچسب UI را خودت قبلاً درست کردی
      })(),
      best_streak_months: doc.lifetime?.streak_best_days ?? 0, // «روز»
      active_months_total: doc.lifetime?.months_active ?? keys.length,
      wallet_age_days: undefined,
      cum_ranks: {
        balance: { rank: doc.rank ?? 0, pct: 0, bucket: undefined },
        activity: undefined,
        volume: undefined,
        overall: { score: 0, rank: doc.rank ?? 0, pct: 0 },
      }
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    return res.status(200).json({ summary, monthly })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'internal error' })
  }
}
