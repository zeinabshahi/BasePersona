// pages/api/health-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const mask = (k?: string) => (k ? `${k.slice(0,8)}…${k.slice(-4)} (len=${k.length})` : null);
  const img = process.env.IMG_OPENAI_API_KEY || '';
  const openai = process.env.OPENAI_API_KEY || '';
  const llm = process.env.LLM_OPENAI_API_KEY || '';
  res.status(200).json({
    ok: true,
    keys: {
      IMG_OPENAI_API_KEY: !!img ? mask(img.trim()) : null,
      OPENAI_API_KEY: !!openai ? mask(openai.trim()) : null,
      LLM_OPENAI_API_KEY: !!llm ? mask(llm.trim()) : null,
    },
    model: process.env.IMG_OPENAI_MODEL || 'gpt-image-1',
  });
}
