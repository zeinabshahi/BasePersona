
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

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
    balance?: { rank:number; pct:number }
    volume?: { rank:number; pct:number }
    activity?: { rank:number; pct:number }
    nft?: { rank:number; pct:number }
    overall?: { rank:number; pct:number; score?:number }
  } | null
}
type Payload = {
  summary: {
    current_streak_months?: number
    best_streak_months?: number
    active_months_total?: number
    wallet_age_days?: number
    first_tx_date?: string | null
    last_tx_date?: string | null
    origin_ym?: number
    cum_ranks?: {
      balance?: { rank:number; pct:number; bucket?:string } | null
      activity?: { rank:number; pct:number } | null
      volume?: { rank:number; pct:number } | null
      overall?: { score?:number; rank?:number; pct?:number } | null
    } | null
    unique_tokens_traded_all?: number
  },
  monthly: Monthly[]
}

function ymStrToInt(s: string){ const [y,m]=s.split('-').map(Number); return y*100 + m }
function ymIntToStr(n: number){ const y=Math.floor(n/100), m=n%100; return `${y}-${String(m).padStart(2,'0')}` }
function ymAdd(ym:number, k:number){ const y=Math.floor(ym/100), m=ym%100; const d=new Date(Date.UTC(y,m-1,1)); d.setUTCMonth(d.getUTCMonth()+k); return d.getUTCFullYear()*100 + (d.getUTCMonth()+1) }
function buildTimeline(origin:number, last:number){ const out:number[]=[]; for(let cur=origin; cur<=last; cur=ymAdd(cur,1)) out.push(cur); return out }
function error(res: NextApiResponse, code: number, msg: string, note?: string){ return res.status(code).json({ error: msg, note }) }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = String(req.query.address || '').toLowerCase().trim()
  if (!address) return error(res, 400, 'address is required')
  return serveCsvFallback(address, res)
}

function serveCsvFallback(address: string, res: NextApiResponse, note?: string) {
  try {
    const csvName = process.env.WALLET_CSV || 'demo_wallet_monthly_full.csv'
    const filePath = path.join(process.cwd(), 'public', 'data', csvName)
    if (!fs.existsSync(filePath)) return error(res, 404, 'csv_not_found', `expected at ${filePath}`)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return error(res, 404, 'csv_empty')

    const header = lines[0].split(',')
    const idx = (name:string) => header.indexOf(name)
    const ixYM = idx('ym')
    const ixAddr = idx('wallet')

    const rows = lines.slice(1).map((ln) => {
      const cols = ln.split(',')
      const wallet = (cols[ixAddr] || '').toLowerCase().trim()
      return { wallet, cols }
    }).filter(r => r.wallet === address)

    if (!rows.length) return error(res, 404, 'wallet_not_found_in_csv', note)

    const byYm = new Map<number, string[]>()
    for (const r of rows) {
      const ym = ymStrToInt(r.cols[ixYM])
      byYm.set(ym, r.cols)
    }

    const allYms = [...byYm.keys()].sort((a,b)=> a-b)
    const originYm = Math.min(...allYms, 202307)
    const lastYm   = Math.max(...byYm.keys())
    const timeline = buildTimeline(originYm, lastYm)

    const g = (cols:string[], name:string) => {
      const i = header.indexOf(name)
      if (i < 0) return 0
      const v = Number(cols[i])
      return Number.isFinite(v) ? v : 0
    }

    const monthly: Monthly[] = timeline.map((ym) => {
      const cols = byYm.get(ym)
      if (!cols) {
        return { ym, month: ymIntToStr(ym), avg_balance_usd:0, avg_balance_eth:0, volume_usd:0, swap_volume_usd:0, bridge_volume_usd:0, native_txs:0, token_txs:0, uniq_contracts:0, uniq_days:0, uniq_weeks:0, nft_unique_contracts:0, nft_holds_builder:0, nft_holds_introduced:0, tokens_traded_unique:0, gas_spent_eth:0, ranks:null }
      }
      const tx_count           = g(cols, 'tx_count')
      const erc20_transfers    = g(cols, 'erc20_transfers')
      const nft_transfers      = g(cols, 'nft_transfers')
      const uniq_days          = g(cols, 'unique_days_active')
      const contracts_interact = g(cols, 'contracts_interacted')
      const fee_eth            = g(cols, 'fee_eth')
      const rank_activity      = g(cols, 'rank_activity')
      const pct_activity       = g(cols, 'pct_activity')
      const rank_fee_usd       = g(cols, 'rank_fee_usd')
      const pct_fee_usd        = g(cols, 'pct_fee_usd')
      const native_txs = Math.max(0, tx_count - erc20_transfers - nft_transfers)
      const token_txs  = erc20_transfers

      return {
        ym,
        month: ymIntToStr(ym),
        avg_balance_usd: 0,
        avg_balance_eth: 0,
        volume_usd: 0,
        swap_volume_usd: 0,
        bridge_volume_usd: 0,
        native_txs,
        token_txs,
        uniq_contracts: contracts_interact,
        uniq_days,
        uniq_weeks: 0,
        nft_unique_contracts: 0,
        nft_holds_builder: 0,
        nft_holds_introduced: 0,
        tokens_traded_unique: 0,
        gas_spent_eth: fee_eth,
        ranks: {
          balance: undefined as any,
          volume: isFinite(rank_fee_usd) ? { rank: rank_fee_usd, pct: pct_fee_usd } as any : undefined,
          activity: isFinite(rank_activity) ? { rank: rank_activity, pct: pct_activity } : undefined,
          nft: undefined as any,
          overall: undefined as any,
        }
      }
    })

    let best = 0, cur = 0, activeMonths = 0, walletAgeDays = 0
    for (const m of monthly) {
      const active = (m.uniq_days || 0) > 0
      walletAgeDays += (m.uniq_days || 0)
      if (active) { activeMonths += 1; cur += 1; if (cur > best) best = cur }
      else { cur = 0 }
    }
    const firstYm = monthly.find(m => (m.uniq_days||0)>0)?.ym ?? monthly[0]?.ym
    const lastYmActive = [...monthly].reverse().find(m => (m.uniq_days||0)>0)?.ym ?? monthly[monthly.length-1]?.ym

    const payload: Payload = {
      summary: {
        current_streak_months: 0,
        best_streak_months: best,
        active_months_total: activeMonths,
        wallet_age_days: walletAgeDays,
        origin_ym: originYm,
        first_tx_date: firstYm ? `${String(Math.floor(firstYm/100)).padStart(4,'0')}-${String(firstYm%100).padStart(2,'0')}-01` : null,
        last_tx_date: lastYmActive ? `${String(Math.floor(lastYmActive/100)).padStart(4,'0')}-${String(lastYmActive%100).padStart(2,'0')}-28` : null,
        cum_ranks: null,
        unique_tokens_traded_all: 0,
      },
      monthly
    }
    return res.status(200).json(payload)
  } catch (e:any) {
    return error(res, 500, e?.message || 'internal_error', note)
  }
}
