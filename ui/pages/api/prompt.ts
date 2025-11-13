// pages/api/prompt.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAnimeLitePrompt } from '../../lib/prompt';
import type { TraitSelectionLite } from '../../lib/traits/minimal';
import type { SpeciesId } from '../../lib/species';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });
  try {
    const { traitsJson, species }: { traitsJson: TraitSelectionLite; species: SpeciesId } = req.body || {};
    if (!traitsJson?.styleLock?.species && !species) {
      return res.status(400).json({ ok:false, error:'missing_traits_or_species' });
    }
    const sp = (traitsJson?.styleLock?.species || species) as SpeciesId;
    const prompt = buildAnimeLitePrompt(traitsJson, sp);
    return res.status(200).json({ ok:true, prompt });
  } catch (e: any) {
    return res.status(500).json({ ok:false, error: e?.message || 'prompt_failed' });
  }
}
