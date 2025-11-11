// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pickSpeciesByNibble } from '../../lib/species';
import { buildLockedPrompt } from '../../lib/prompt';
import { generateWithOpenAI } from '../../lib/imageProvider';

function isAddr(s?: string) { return !!s && /^0x[a-fA-F0-9]{40}$/.test(String(s)); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });
  try {
    const { address, traitsJson, persona } = req.body || {};
    if (!isAddr(address)) return res.status(400).json({ ok:false, error:'bad_address' });

    const species = (traitsJson?.species as string) || pickSpeciesByNibble(address);
    const prompt  = buildLockedPrompt({ species, traitsJson, persona });

    const out = await generateWithOpenAI({ species, prompt });
    if (!out.ok) return res.status(502).json({ ok:false, error: out.error || 'generate_failed' });

    return res.status(200).json({
      ok: true,
      providerUsed: out.provider,
      promptUsed: out.promptUsed,
      imageURL: `data:image/png;base64,${out.imageB64}`,
      size: '1024x1024',
    });
  } catch (e: any) {
    return res.status(500).json({ ok:false, error: e?.message || 'generate_failed' });
  }
}
