import type { NextApiRequest, NextApiResponse } from 'next'

type PriceResp = { ok: boolean; usd: number | null; cached?: boolean; error?: string }

const TTL_MS = Number(process.env.ETHUSD_TTL_MS || 180_000)

let cache = { usd: null as number | null, at: 0 }

async function fetchWithTimeout(url: string, ms = 2000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'base-persona/1.0' } as any })
    if (!r.ok) throw new Error('http_' + r.status)
    return await r.json()
  } finally {
    clearTimeout(id)
  }
}

async function getFromCoinbase(): Promise<number | null> {
  const j: any = await fetchWithTimeout('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
  const v = Number(j?.data?.rates?.USD)
  return Number.isFinite(v) ? v : null
}
async function getFromCoinGecko(): Promise<number | null> {
  const j: any = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
  const v = Number(j?.ethereum?.usd)
  return Number.isFinite(v) ? v : null
}
async function getFromBinance(): Promise<number | null> {
  const j: any = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
  const v = Number(j?.price)
  return Number.isFinite(v) ? v : null
}

async function getEthUsd(): Promise<number | null> {
  // کش 60 ثانیه
  if (cache.usd && Date.now() - cache.at < TTL_MS) return cache.usd
  const providers = [getFromCoinbase, getFromCoinGecko, getFromBinance]
  for (const fn of providers) {
    try {
      const v = await fn()
      if (v && Number.isFinite(v)) {
        cache = { usd: v, at: Date.now() }
        return v
      }
    } catch { /* try next */ }
  }
  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PriceResp>) {
  try {
    const cached = cache.usd && Date.now() - cache.at < TTL_MS
    const usd = await getEthUsd()
    if (!usd) {
      // شکست اما 200 بده که اسپم 500 نشه؛ فرانت خودش null رو هندل می‌کنه
      return res.status(200).json({ ok: false, usd: null, error: 'no_price' })
    }
    res.status(200).json({ ok: true, usd, cached })
  } catch (e: any) {
    // باز هم 200 تا لاگ 500 نگیری؛ ok=false
    res.status(200).json({ ok: false, usd: null, error: e?.message || 'price_failed' })
  }
}
