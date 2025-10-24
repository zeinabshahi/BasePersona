import type { NextApiRequest, NextApiResponse } from 'next'
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok:true, ts: Date.now(), imgProvider: process.env.IMG_PROVIDER || 'openai', llmProvider: process.env.LLM_PROVIDER || 'openai' })
}
