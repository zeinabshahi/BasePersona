// pages/api/narrative.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { chatComplete } from '../../lib/llmProvider';

type PersonaJson = {
  title: string;
  oneLiner: string;
  summary: string;
  highlights: string[];
  personalityTags: string[];
};

function safeParseJson(s: string): PersonaJson | null {
  try {
    const j = JSON.parse(s);
    if (j && typeof j === 'object') {
      const { title, oneLiner, summary } = j as any;
      const highlights = Array.isArray((j as any).highlights) ? (j as any).highlights : [];
      const personalityTags = Array.isArray((j as any).personalityTags) ? (j as any).personalityTags : [];
      if ((title || oneLiner || summary) && highlights && personalityTags) {
        return { title: title || 'Onchain Persona', oneLiner: oneLiner || '', summary: summary || '', highlights, personalityTags };
      }
    }
  } catch {}
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });

  try {
    const { address, persona, metrics } = req.body || {};
    const system =
      'You are Rankora’s persona writer. Return concise JSON only (no prose). ' +
      'Avoid any visual descriptors. Tone: human, confident, Base-native.';

    const user = [
      'Write a short persona summary for a crypto wallet on Base.',
      'Constraints:',
      '- Output JSON with keys: title, oneLiner, summary, highlights (array), personalityTags (array).',
      '- No mention of exact numbers; paraphrase activity.',
      '- Keep summary <= 120 words.',
      '- No camera/visual/style words.',
      '',
      'Context (free-form, optional):',
      `address: ${address || ''}`,
      `metrics: ${metrics ? JSON.stringify(metrics).slice(0, 1500) : '{}'}`,
      `personaHint: ${persona ? JSON.stringify(persona).slice(0, 800) : '{}'}`,
    ].join('\n');

    const out = await chatComplete({
      system,
      messages: [{ role: 'user', content: user }],
      json: true,
    });

    if (!out.ok) {
      return res.status(out.status || 502).json({ ok:false, error: out.error, provider: out.provider, debug: out.body });
    }

    const parsed = safeParseJson(out.text) || {
      title: 'Onchain Persona',
      oneLiner: 'Explorer energy with builder instincts.',
      summary: 'Low noise, high signal. Patient when markets shout, decisive when chances whisper. Feels very Base: ship > shout.',
      highlights: ['cadence: bursts, then breathers', 'risk: measured curiosity', 'social: ship > shout'],
      personalityTags: [],
    };

    return res.status(200).json({ ok: true, narrativeJson: parsed });
  } catch (e: any) {
    return res.status(500).json({ ok:false, error: e?.message || 'narrative_failed' });
  }
}
