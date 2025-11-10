import type { NextApiRequest, NextApiResponse } from 'next'
import { getDb } from '../../lib/db'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = String(req.query.q ?? '').trim().toLowerCase()
  if (!raw) return res.status(400).json({ error: 'missing q' })

  // اگر 0x ننوشت، خودمون اضافه کنیم
  const prefix = (raw.startsWith('0x') ? raw : '0x' + raw).slice(0, 42)

  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT wallet, rank
      FROM wallet_doc
      WHERE wallet LIKE ?
      ORDER BY rank ASC
      LIMIT 20
    `).all(prefix + '%')

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120')
    return res.status(200).json({ q: raw, results: rows })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'internal error' })
  }
}
