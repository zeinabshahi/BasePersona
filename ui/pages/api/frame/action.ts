import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Handle Farcaster frame button actions. This example simply returns a stub
 * response indicating that the action is unimplemented. In a production
 * deployment you would update the frame state or initiate a mint based on
 * which button was pressed.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.status(200).json({ message: 'Frame action not implemented' });
}
