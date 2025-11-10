// pages/api/wcdn/[address].ts
import type { NextApiRequest, NextApiResponse } from 'next'

const GH_USER = process.env.WALLETS_GH_USER || 'zeinabshahi' // در صورت نیاز عوض کن
const BRANCH  = process.env.WALLETS_GH_BRANCH || 'main'

function splitAddr(addr: string) {
  const a = addr.toLowerCase()
  if (!a.startsWith('0x') || a.length < 5) throw new Error('bad address')
  const nibble = a[2]          // e.g. '6'
  const pre2   = a.slice(2, 4) // e.g. '6c'
  return { nibble, pre2, norm: a }
}

async function fetchRaw(user: string, repo: string, path: string, branch: string) {
  // اول raw.githubusercontent؛ اگر نشد jsDelivr
  const raw = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`
  let r = await fetch(raw, { headers: { 'Accept': 'application/json' } })
  if (r.ok) return r
  const cdn = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`
  r = await fetch(cdn, { headers: { 'Accept': 'application/json' } })
  return r
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const address = String(req.query.address || '')
    const { nibble, pre2, norm } = splitAddr(address)
    const repo = `wallets-${nibble}`
    const path = `${pre2}/${norm}.json`

    const r = await fetchRaw(GH_USER, repo, path, BRANCH)
    if (!r.ok) return res.status(r.status).json({ error: `github ${r.status}` })

    const json = await r.json()
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    return res.status(200).json(json)
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'bad request' })
  }
}
