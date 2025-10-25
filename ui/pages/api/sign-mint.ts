import type { NextApiRequest, NextApiResponse } from 'next';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Create an EIP‑712 MintAuth signature. This endpoint reads the server‑side
 * private key from the environment and signs the provided payload. Ensure that
 * `PRIVATE_KEY` is set in your environment (.env) and never exposed to
 * clients. The resulting signature can be submitted to the on‑chain
 * contract to mint the NFT.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = req.body;
    const {
      to,
      periodId,
      statsHash,
      traitsHash,
      price,
      deadline,
      modelVersion,
      promptHash,
      quoteId,
      quoteAt,
      quoteSourceHash,
    } = body;
    const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk) {
      res.status(500).json({ error: 'Server private key not configured' });
      return;
    }
    const account = privateKeyToAccount(pk);
    // Domain for the EIP‑712 signature
    const domain = {
      name: 'ActivityPersona',
      version: '1',
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453),
      verifyingContract: process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`,
    };
    const types = {
      MintAuth: [
        { name: 'to', type: 'address' },
        { name: 'periodId', type: 'uint256' },
        { name: 'statsHash', type: 'bytes32' },
        { name: 'traitsHash', type: 'bytes32' },
        { name: 'price', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'modelVersion', type: 'uint256' },
        { name: 'promptHash', type: 'bytes32' },
        { name: 'quoteId', type: 'bytes32' },
        { name: 'quoteAt', type: 'uint256' },
        { name: 'quoteSourceHash', type: 'bytes32' },
      ],
    } as const;
    // Build the message from the payload, converting numeric fields to BigInt
    const message = {
      to: to as `0x${string}`,
      periodId: BigInt(periodId),
      statsHash: statsHash as `0x${string}`,
      traitsHash: traitsHash as `0x${string}`,
      price: BigInt(price),
      deadline: BigInt(deadline),
      modelVersion: BigInt(modelVersion),
      promptHash: promptHash as `0x${string}`,
      quoteId: quoteId as `0x${string}`,
      quoteAt: BigInt(quoteAt),
      quoteSourceHash: quoteSourceHash as `0x${string}`,
    } as const;
    // Sign the typed data
    const signature = await account.signTypedData({ domain, types, primaryType: 'MintAuth', message });
    res.status(200).json({ auth: message, sig: signature });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
