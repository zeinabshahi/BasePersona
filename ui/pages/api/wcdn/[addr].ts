import type { NextApiRequest, NextApiResponse } from 'next'

const OWNER =
  process.env.WCDN_OWNER ||
  process.env.NEXT_PUBLIC_WCDN_OWNER ||
  'zeinabshahi'

// repo: بر اساس اولین کاراکتر بعد از 0x  → wallets-6 / wallets-c / ...
function repoFor(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, '')
  const first = a[0] || '0'
  return `wallets-${first}`
}

// path: پوشه‌ی دوکاراکتری اول  → 63/0x63...json
function pathFor(addr: string) {
  const a = addr.toLowerCase().replace(/^0x/, '')
  const pfx = a.slice(0, 2)
  return `${pfx}/0x${a}.json`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const addr = String(req.query.addr || '').toLowerCase()
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      res.status(400).json({ error: 'invalid address' }); return
    }

    const url = `https://raw.githubusercontent.com/${OWNER}/${repoFor(addr)}/main/${pathFor(addr)}`
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) { res.status(404).json({ error: 'not found', url }); return }

    const j = await r.json()
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
    res.status(200).json(j)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
}
