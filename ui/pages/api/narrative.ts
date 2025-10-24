import type { NextApiRequest, NextApiResponse } from 'next';
import { generateNarrative } from '../../lib/ai/llm';
import { canonicalJson, toKeccakHex } from '../../lib/utils';

/**
 * Generate a narrative JSON using an LLM. The request accepts persona,
 * traits, analytics and timeAnchor fields. The response includes the
 * narrative JSON and a deterministic seed derived from the input. On
 * errors the API returns a 500 error with a message.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  try {
    const { persona, traits, analytics, timeAnchor } = req.body || {};
    const narrativeJson = await generateNarrative({ persona, traits, analytics, timeAnchor });
    // compute a deterministic seed from all inputs and a version string
    const seed = toKeccakHex(
      canonicalJson({ persona, traits, analytics, timeAnchor, v: 'narrative_en_v2' })
    );
    res.status(200).json({ narrativeJson, seed });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'narrative_failed' });
  }
}