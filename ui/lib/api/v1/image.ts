// ui/pages/api/v1/image.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { renderImage } from '../../../lib/ai/image' // مسیر درست از /pages/api/v1/…

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { prompt, size = '1024x1024', provider, negativePrompt, highDetail } = req.body || {}
    if (!prompt) return res.status(400).json({ ok:false, error:'missing_prompt' })

    const out = await renderImage({ prompt, size, provider, negativePrompt, highDetail })
    const imageURL = `data:image/png;base64,${out.b64png}`

    // اگر fallback پیکسلی 1×1 بود، ok=false تا واضح شود
    const isFallback = out.b64png.length < 120
    return res.status(200).json({
      ok: !isFallback,
      imageURL,
      providerUsed: out.providerUsed,
      promptUsed: out.promptUsed,
      size: out.size,
      ...(isFallback ? { error: 'provider_failed_fallback_pixel' } : {}),
    })
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'generate_failed' })
  }
}
