// lib/typesWallet.ts
export type Ym = `${number}-${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}`

export type MonthRow = {
  txs: number
  uniq: number
  trade: number
  nft: number
  gas: number
  bal: number
  days: number
  spread: number
  streak: number
  rank_m: number
  pct_m: number
}

export type Lifetime = {
  months_active: number
  first: Ym
  last: Ym
  tx_sum: number
  uniq_sum: number
  trade_sum: number
  nft_sum: number
  gas_sum: number
  avg_balance_eth_mean: number
  streak_best_days: number
}

export type WalletDoc = {
  wallet: `0x${string}`
  rank: number
  lifetime: Lifetime
  months: Record<Ym, MonthRow>
}
