import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const v = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  res.status(200).json({ hasValue: !!v, length: v?.length ?? 0 })
}
