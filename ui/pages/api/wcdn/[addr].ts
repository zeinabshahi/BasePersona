// pages/api/wcdn/[addr].ts
import type { NextApiRequest, NextApiResponse } from 'next'

const OWNER =
  process.env.WCDN_OWNER ||
  process.env.NEXT_PUBLIC_WCDN_OWNER ||
  'zeinabshahi'

function toRawUrl(addr: string) {
  const a = addr.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(a)) throw new Error('invalid address')
  const shard = a[2]                  // 0..f
  const p2 = a.slice(2, 4)            // 00..ff
  const repo = `wallets-${shard}`
  const path = `${p2}/${a}.json`
  return `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${path}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const addr = String(req.query.addr || '')
    const url = toRawUrl(addr)
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return res.status(404).json({ error: 'not-found' })
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    const json = await r.json()
    return res.status(200).json(json)
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? 'bad-request' })
  }
}
