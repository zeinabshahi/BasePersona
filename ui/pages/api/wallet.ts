import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb, DB_PATH } from '../../lib/db'

const HEX = /^0x[0-9a-fA-F]{40}$/

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = String(req.query.address ?? '').trim()
  const addr = raw.toLowerCase()
  if (!HEX.test(addr)) {
    res.setHeader('x-db-path', DB_PATH || '')
    return res.status(400).json({ error: 'invalid address (expect 0x + 40 hex)' })
  }
  try {
    const db = getDb()
    const row = db
      .prepare('SELECT rank, lifetime_json, months_json FROM wallet_doc WHERE wallet = ?')
      .get(addr)
    res.setHeader('x-db-path', DB_PATH || '')
    if (!row) return res.status(404).json({ error: 'wallet not found' })
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      wallet: addr,
      rank: row.rank,
      lifetime: JSON.parse(row.lifetime_json),
      months: JSON.parse(row.months_json),
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'internal error' })
  }
}
