// lib/demoMetrics.ts
export type Rank = { rank:number; pct:number; score?:number }

export type Monthly = {
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

export type Summary = {
  current_streak_months?: number
  best_streak_months?: number
  active_months_total?: number
  wallet_age_days?: number
  origin_ym?: number
  first_tx_date?: string | null
  last_tx_date?: string | null
  cum_ranks?: {
    balance?: { rank:number; pct:number; bucket?:string } | null
    activity?: Rank | null
    volume?: Rank | null
    overall?: { score?:number; rank?:number; pct?:number } | null
  } | null
  unique_tokens_traded_all?: number
}

export type Payload = { summary: Summary; monthly: Monthly[] }

export function ymAdd(ym:number, k:number){
  const y=Math.floor(ym/100), m=ym%100
  const d=new Date(Date.UTC(y,m-1,1))
  d.setUTCMonth(d.getUTCMonth()+k)
  return d.getUTCFullYear()*100 + (d.getUTCMonth()+1)
}
export function ymIntToStr(n:number){
  const y=Math.floor(n/100), m=n%100
  return `${y}-${String(m).padStart(2,'0')}`
}

export function bestStreakFromDays(months:{uniq_days?:number}[]) {
  let cur=0, best=0, active=0, days=0
  for (const m of months) {
    const a = (m.uniq_days||0)>0
    days += (m.uniq_days||0)
    if (a){ cur++; active++; best=Math.max(best,cur) } else { cur=0 }
  }
  return {best, active, days}
}

/** Demo payload for UI fallback (from Jul-2023 to current month) */
export function genDemoPayload(originYm=202307): Payload {
  const now = new Date()
  const endYm = now.getUTCFullYear()*100 + (now.getUTCMonth()+1)
  const yms:number[] = []
  for(let ym=originYm; ym<=endYm; ym=ymAdd(ym,1)) yms.push(ym)

  const monthly: Monthly[] = yms.map((ym,i)=>({
    ym,
    month: ymIntToStr(ym),
    avg_balance_eth: +(0.12 + (i%7)*0.015).toFixed(3),
    volume_usd: Math.round(120 + (i*30)%600),
    native_txs: 2 + (i%4),
    token_txs: 1 + (i%3),
    uniq_contracts: 1 + (i%5),
    uniq_days: (i%9===0)? 0 : (2 + (i%6)),
    tokens_traded_unique: (i%5),
    gas_spent_eth: +(0.003 + i*0.0003).toFixed(4),
    ranks: {} as any
  }))
  const meta = bestStreakFromDays(monthly)
  return {
    summary: {
      current_streak_months: 0,
      best_streak_months: meta.best,
      active_months_total: meta.active,
      wallet_age_days: meta.days,
      origin_ym: originYm,
      first_tx_date: null,
      last_tx_date: null,
      cum_ranks: null,
      unique_tokens_traded_all: 0
    },
    monthly
  }
}
