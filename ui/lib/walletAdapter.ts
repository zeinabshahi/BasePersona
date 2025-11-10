// lib/walletAdapter.ts
import type { WalletDoc, Ym, MonthRow, Lifetime } from './typesWallet'

export type UiMonth = MonthRow & { ym: Ym }

export interface UiWallet {
  wallet: string
  rank?: number
  lifetime?: Lifetime
  monthsArr: UiMonth[]
  activeMonths: number
  bestStreakDays: number
  txTotal: number
  uniqTotal: number
  tradeTotal: number
  nftTotal: number
  gasTotalEth: number
  avgBalEth: number
}

const parseYm = (ym: Ym): number => {
  const [y, m] = ym.split('-').map(Number)
  return y * 100 + m
}
const toYmStr = (ymInt: number): Ym => {
  const y = Math.floor(ymInt / 100)
  const m = ymInt % 100
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}` as Ym
}
const nextYm = (ymInt: number): number => {
  const y = Math.floor(ymInt / 100)
  const m = ymInt % 100
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1)
}

const num = (v: any, def = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

export function adaptWallet(doc: WalletDoc) {
  const startInt = parseYm(doc.lifetime.first)
  const endInt   = parseYm(doc.lifetime.last)

  const timeline: number[] = []
  for (let cur = startInt; cur <= endInt; cur = nextYm(cur)) timeline.push(cur)

  const monthsArr = timeline.map((ymInt) => {
    const ym = toYmStr(ymInt)
    const raw: any = (doc.months as any)[ym] ?? {}
    const row: MonthRow = {
      txs:    num(raw.txs),
      uniq:   num(raw.uniq),
      trade:  num(raw.trade),
      nft:    num(raw.nft),
      gas:    num(raw.gas),
      bal:    num(raw.bal),
      days:   num(raw.days),
      spread: num(raw.spread),
      streak: num(raw.streak),   // ← استریک ماهانه از JSON
      rank_m: num(raw.rank_m),
      pct_m:  num(raw.pct_m),
    }
    return { ym, ...row }
  })

  const sum = (a: number[]) => a.reduce((x, y) => x + (y || 0), 0)
  const nonZeroBal = monthsArr.map(m => m.bal || 0).filter(v => v > 0)
  const avgBalEth =
    nonZeroBal.length
      ? sum(nonZeroBal) / nonZeroBal.length
      : sum(monthsArr.map(m => m.bal || 0)) / Math.max(1, monthsArr.length)

  const bestStreakDays =
    num(doc.lifetime.streak_best_days) ||
    Math.max(0, ...monthsArr.map(m => m.streak || 0))

  const gasTotalEth =
    Number.isFinite(num((doc.lifetime as any).gas_sum_filled, NaN))
      ? Number((doc.lifetime as any).gas_sum_filled)
      : (Number.isFinite(num(doc.lifetime.gas_sum, NaN))
          ? Number(doc.lifetime.gas_sum)
          : sum(monthsArr.map(m => m.gas || 0)))

  const act = (m: UiMonth) => (m.txs||m.uniq||m.trade||m.nft||m.days||m.gas||m.bal)
  const activeMonths = monthsArr.filter(act).length

  return {
    wallet: doc.wallet,
    rank: doc.rank,
    lifetime: doc.lifetime,
    monthsArr,
    activeMonths,
    bestStreakDays,
    txTotal:   num(doc.lifetime.tx_sum),
    uniqTotal: num(doc.lifetime.uniq_sum),
    tradeTotal:num(doc.lifetime.trade_sum),
    nftTotal:  num(doc.lifetime.nft_sum),
    gasTotalEth,
    avgBalEth,
  }
}
