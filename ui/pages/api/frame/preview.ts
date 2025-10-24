import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Serve a placeholder image for Farcaster frame previews. In a production
 * deployment this would fetch the actual generated bitmap from Arweave or IPFS
 * using the provided tokenId. Here we simply return the Base logo SVG as a
 * stand‑in.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tokenId = req.query.tokenId as string;
  try {
    const filePath = path.join(process.cwd(), 'public', 'base_logo.svg');
    const svg = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);
  } catch (err: any) {
    res.status(404).json({ error: 'Preview not found' });
  }
}
