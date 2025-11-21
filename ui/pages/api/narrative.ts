// pages/api/narrative.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { chatComplete } from '../../lib/llmProvider';
import { pickSpeciesByNibble } from '../../lib/species';

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
      const highlights = Array.isArray((j as any).highlights)
        ? (j as any).highlights
        : [];
      const personalityTags = Array.isArray((j as any).personalityTags)
        ? (j as any).personalityTags
        : [];

      if (title || oneLiner || summary) {
        return {
          title: title || 'Onchain Persona',
          oneLiner: oneLiner || '',
          summary: summary || '',
          highlights,
          personalityTags,
        };
      }
    }
  } catch {}
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const { address, persona, metrics } = req.body || {};

    const addr = typeof address === 'string' ? address : '';
    const species = /^0x[a-fA-F0-9]{40}$/.test(addr)
      ? pickSpeciesByNibble(addr)
      : 'owl';

    const system = `
You are Rankora’s persona writer for Base, an Ethereum L2.
You turn onchain metrics for a wallet into a short, cool, story-like personality summary.

OUTPUT FORMAT
- Return ONLY compact JSON with keys:
  - "title" (string)
  - "oneLiner" (string)
  - "summary" (string)
  - "highlights" (array of 0–2 short strings)
  - "personalityTags" (array of 0–3 short tags, lowercase)
- Do NOT include any extra fields.
- Do NOT wrap JSON in markdown or prose (no backticks, no commentary).
- Tone: human, confident, builder-friendly, Base-native; not corporate, not cringe.

SPECIES / CHARACTER
- This wallet is represented as an anthropomorphic "${species}" character.
- "title" must feel like a nickname for this ${species} and MUST include the word "${species}" exactly once.
  Examples of style (do not copy): "Signal Fox", "Builder Owl", "Orbit Dolphin".
- The story should read like how this ${species} spends time on Base.

STYLE RULES
- Avoid visual / camera / art / style words (no talk of colors, lighting, 3D, PFPs, poses, etc.).
- Do NOT mention exact numbers or dates.
  - Never write concrete counts like "173 tx", "12 NFTs", or "0.02 ETH".
  - Use qualitative phrases like "light but steady activity", "heavy user", "long-term regular", "short experimental bursts".
- It is okay to mention "Base" by name, but not more than 2 times.
- No financial advice, no explicit APY / leverage / casinos / betting language.
- Language should be simple, clear, and conversational — not poetic or flowery.
- Vary phrasing so it doesn’t feel templated; avoid repeating stock phrases like
  "light but steady activity" or "quality over quantity" if the same idea already appears in the summary.
`.trim();

    const contextJson = JSON.stringify(
      {
        address: addr,
        species,
        metrics: metrics || null,
        personaHint: persona || null,
      },
      null,
      2,
    );

    const user = [
      'Write a persona for a crypto wallet on Base, using the context JSON below.',
      '',
      'Constraints:',
      `- "title": 2–4 words, MUST include the species word exactly once ("${species}"), no emoji.`,
      '- "oneLiner": max 14 words, feels like a tagline on a Base dashboard.',
      '- "summary": a single short paragraph (3–6 sentences, <= 120 words).',
      `   It should read like a tiny story about how this ${species} spends time onchain:`,
      '   when they usually appear, what they tend to do (swap, mint, bridge, experiment),',
      '   and what that says about their personality as a builder/collector on Base.',
      '- "highlights": 0–2 items. Each item must be:',
      '   - a single short informal phrase (max ~8 words)',
      '   - no prefixes like "cadence:" / "risk:" / "social:"',
      '   - not just repeating lines from the summary, but adding a little flavor',
      '- "personalityTags": 0–3 short tags, lowercase, like "base_native", "quiet_builder", "early_explorer".',
      '',
      'Important:',
      '- Use the metrics to infer relative behavior (light vs heavy, early vs recent, NFTs vs DeFi, etc.).',
      '- No exact numbers or dates; everything should be relative / qualitative.',
      '- No visual descriptions.',
      '',
      'Context JSON:',
      '```json',
      contextJson.slice(0, 4000),
      '```',
    ].join('\n');

    const out = await chatComplete({
      system,
      messages: [{ role: 'user', content: user }],
      json: true,
    });

    if (!out.ok) {
      return res.status(out.status || 502).json({
        ok: false,
        error: out.error,
        provider: out.provider,
        debug: out.body,
      });
    }

    const parsed =
      safeParseJson(out.text) ||
      ({
        title: `Builder ${species}`,
        oneLiner: 'Shows up with intent when Base is worth their time.',
        summary:
          `This ${species} moves through Base with a calm, builder-minded rhythm — not farming everything, but showing up when something feels genuinely interesting. Activity comes in focused waves: testing new contracts, trying a few mints, or checking in on familiar protocols. It feels more like product scouting than degen roulette. Over time, the pattern looks like someone quietly mapping the ecosystem, keeping notes, and sticking around when things actually ship.`,
        highlights: [
          'checks in when new things launch',
          'curious without chasing every hype wave',
        ],
        personalityTags: ['base_native', 'quiet_builder'],
      } as PersonaJson);

    return res.status(200).json({ ok: true, narrativeJson: parsed });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'narrative_failed' });
  }
}
