// pages/api/provider-check.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const mask = (s?: string | null) =>
    s ? `${s.slice(0, 7)}…${s.slice(-4)} (len=${s.length})` : null;

  const env = process.env as Record<string, string | undefined>;

  res.status(200).json({
    ok: true,
    IMG_PROVIDER: env.IMG_PROVIDER || 'openrouter',
    LLM_PROVIDER: env.LLM_PROVIDER || 'openrouter',
    models: {
      // 🔁 پیش‌فرض: GPT-5-Image روی OpenRouter
      image: env.IMG_OPENROUTER_MODEL || 'openai/gpt-5-image',
      llm: env.LLM_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    },
    keys: {
      OPENROUTER_API_KEY: mask(
        env.OPENROUTER_API_KEY ||
          env.IMG_OPENROUTER_API_KEY ||
          env.LLM_OPENROUTER_API_KEY ||
          null,
      ),
    },
    base: {
      OPENROUTER_BASE_URL:
        env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    },
  });
}
