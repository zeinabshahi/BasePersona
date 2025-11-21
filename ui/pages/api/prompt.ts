// pages/api/prompt.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAnimeLitePrompt } from '../../lib/prompt';
import type { TraitSelectionLite } from '../../lib/traits/minimal';
import type { Species } from '../../lib/species';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const {
      traitsJson,
      species,
    } = (req.body || {}) as {
      traitsJson?: TraitSelectionLite;
      species?: Species;
    };

    if (!traitsJson) {
      return res
        .status(400)
        .json({ ok: false, error: 'missing_traits' });
    }

    // species نهایی: یا از styleLock می‌آد، یا از body، یا پیش‌فرض owl
    const sp: Species =
      (traitsJson.styleLock as any)?.species ||
      species ||
      'owl';

    const { prompt } = buildAnimeLitePrompt(traitsJson, sp);

    return res.status(200).json({ ok: true, prompt });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || 'prompt_failed',
    });
  }
}
