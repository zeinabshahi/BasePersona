import type { NextApiRequest, NextApiResponse } from 'next'
import { generateNarrative } from '../../../lib/ai/llm'
import { toKeccakHex } from '../../../lib/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { persona={}, traits={}, analytics={}, timeAnchor={ nowUnix: Math.floor(Date.now()/1000) } } = req.body || {}
    const narrativeJson = await generateNarrative({ persona, traits, analytics, timeAnchor })
    const seed = toKeccakHex(JSON.stringify({ persona, traits, analytics, timeAnchor, v:'narrative_v1' }))
    res.status(200).json({ ok:true, narrativeJson, seed })
  } catch (e:any) {
    res.status(500).json({ ok:false, error:e?.message || 'narrative_failed' })
  }
}
// pages/api/narrative.ts   (یا مسیر فعلی‌ای که داری)
import type { NextApiRequest, NextApiResponse } from 'next'
import { generateNarrative } from '../../../lib/ai/llm'   // <- مسیر را با ساختار پروژه‌ات تنظیم کن
import { toKeccakHex } from '../../../lib/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { persona = {}, traits = {}, analytics = {}, timeAnchor = { nowUnix: Math.floor(Date.now()/1000) } } = req.body || {}
    const { narrative, meta } = await generateNarrative({ persona, traits, analytics, timeAnchor })
    const seed = toKeccakHex(JSON.stringify({ persona, traits, analytics, timeAnchor, v:'narrative_v1' }))
    res.status(200).json({ ok:true, narrativeJson: narrative, seed, meta })
  } catch (e:any) {
    res.status(500).json({ ok:false, error:e?.message || 'narrative_failed' })
  }
}
