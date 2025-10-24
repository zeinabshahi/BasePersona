// ui/lib/api/auth.ts
import type { NextApiRequest, NextApiResponse } from 'next'

/** هدر: x-api-key  — اگر INTERNAL_API_KEY ست شده باشد، الزامی می‌شود */
export function requireApiKey(req: NextApiRequest) {
  const need = !!process.env.INTERNAL_API_KEY
  if (!need) return true
  const key = req.headers['x-api-key']
  return typeof key === 'string' && key === process.env.INTERNAL_API_KEY
}

/** ریت‌لیمیت ساده در حافظه: limit ریکوئست در intervalMs بر اساس IP */
const buckets = new Map<string, { tokens: number; ts: number }>()
export function rateLimit(req: NextApiRequest, limit = 30, intervalMs = 60_000) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || (req.socket as any)?.remoteAddress || '0.0.0.0'
  const now = Date.now()
  const b = buckets.get(ip) || { tokens: limit, ts: now }
  const elapsed = now - b.ts
  if (elapsed > intervalMs) { b.tokens = limit; b.ts = now }
  if (b.tokens <= 0) return false
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}

export function send429(res: NextApiResponse) {
  res.status(429).json({ ok:false, error:'rate_limited' })
}
export function send401(res: NextApiResponse) {
  res.status(401).json({ ok:false, error:'unauthorized' })
}
