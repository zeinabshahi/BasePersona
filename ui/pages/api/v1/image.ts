// pages/api/v1/image.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { renderImage } from '../../../lib/ai/image' // ← از lib شما استفاده می‌کنیم

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { prompt, size = '1024x1024', provider, negativePrompt, highDetail, seedInput } = req.body || {}
    if (!prompt) return res.status(400).json({ ok:false, error:'missing_prompt' })

    const out = await renderImage({ prompt, size, provider, negativePrompt, highDetail, seedInput })
    const imageURL = out?.b64png ? `data:image/png;base64,${out.b64png}` : undefined

    // renderImage در بدترین حالت پیکسل شفاف می‌دهد؛ پس imageURL همیشه تعریف می‌شود.
    res.status(200).json({
      ok: !!imageURL,
      imageURL,
      providerUsed: out.providerUsed,
      promptUsed: out.promptUsed,
      size: out.size,
    })
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || 'generate_failed' })
  }
}
