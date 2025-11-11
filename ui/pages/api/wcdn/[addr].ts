import type { NextApiRequest, NextApiResponse } from 'next'

const GH_USER  = process.env.WALLETS_GH_USER   || 'zeinabshahi'
const BRANCH   = process.env.WALLETS_GH_BRANCH || 'main'
const REPO_PRE = process.env.WALLETS_GH_REPO_PREFIX || 'wallets-'   // برای شارد: wallets-0..f
const RAW_BASE = (process.env.WALLETS_GH_RAW || '').replace(/\/+$/, '') // برای تک‌ریپو: .../wallets

function isEvmAddress(s: string) { return /^0x[a-fA-F0-9]{40}$/.test(s) }
function abortSignal(ms: number) { const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return {signal:c.signal,cancel:()=>clearTimeout(t)} }
async function fetchJson(url: string, signal: AbortSignal) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal })
  if (!r.ok) return { ok:false, status:r.status, url }
  try { return { ok:true, json: await r.json(), url } }
  catch { return { ok:false, status:502, url } }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const addressParam = String(req.query.address || '').trim()
  if (!isEvmAddress(addressParam)) return res.status(400).json({ error: 'invalid_address' })

  const addr = addressParam.toLowerCase()
  const { signal, cancel } = abortSignal(Number(process.env.WCDN_TIMEOUT_MS ?? 8000))

  try {
    let urlA = ''; let urlB = ''

    if (RAW_BASE) {
      // حالت تک‌ریپو
      urlA = `${RAW_BASE}/${addr}.json`
    } else {
      // حالت شارد: wallets-{nibble}/{pre2}/{addr}.json
      const nibble = addr[2]
      const pre2   = addr.slice(2, 4)
      const repo   = `${REPO_PRE}${nibble}`
      const path   = `${pre2}/${addr}.json`
      urlA = `https://raw.githubusercontent.com/${GH_USER}/${repo}/${BRANCH}/${path}`
      urlB = `https://cdn.jsdelivr.net/gh/${GH_USER}/${repo}@${BRANCH}/${path}`
    }

    const r1 = await fetchJson(urlA, signal)
    if (r1.ok) { cancel(); res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600'); return res.status(200).json(r1.json) }

    if (urlB) {
      const r2 = await fetchJson(urlB, signal)
      if (r2.ok) { cancel(); res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600'); return res.status(200).json(r2.json) }
      cancel()
      const status = (r1.status===404 || r2.status===404) ? 404 : (r2.status || 502)
      return res.status(status).json({ error:'upstream_error', tried:[r1.url, r2.url], status1:r1.status, status2:r2.status })
    }

    cancel()
    return res.status(r1.status || 404).json({ error:'upstream_error', tried:[r1.url], status1:r1.status })
  } catch (e:any) {
    cancel()
    console.error('[wcdn] fatal:', e?.message || e)
    return res.status(502).json({ error:'upstream_fetch_failed' })
  }
}
