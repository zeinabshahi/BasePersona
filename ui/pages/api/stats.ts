import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { canonicalJson, toKeccakHex } from '../../lib/utils';

/**
 * API route to compute canonical stats and a time anchor for a given address. This
 * implementation uses a simple stub for metrics; you should integrate real
 * analytics here (e.g., scanning the Base blockchain or querying an indexer).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const address = (req.query.address as string || '').toLowerCase();
  if (!address) {
    res.status(400).json({ error: 'Missing address parameter' });
    return;
  }
  try {
    // Determine the chain to connect to based on chain id
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
    const chain = chainId === 8453 ? base : baseSepolia;
    const rpcUrl = process.env.RPC_URL || chain.rpcUrls?.default?.http?.[0];
    const client = createPublicClient({ chain, transport: http(rpcUrl!) });
    // Fetch the latest block for timeAnchor. Fallback to Date.now() if RPC fails.
    let blockNumber: number | undefined;
    let blockTimestamp: number | undefined;
    try {
      const block = await client.getBlock();
      blockNumber = Number(block.number);
      // Some RPC providers return bigint timestamps
      const ts = (block.timestamp as any) as bigint | number;
      blockTimestamp = typeof ts === 'bigint' ? Number(ts) : ts;
    } catch (e) {
      // ignore RPC errors; fallback to monotonic time
    }
    const nowUnix = Math.floor(Date.now() / 1000);
    const timeAnchor: any = {
      blockNumber,
      blockTimestamp,
      nowUnix,
    };
    // TODO: Implement real analytics here. For now, metrics are mocked.
    const metrics = {
      txCount: 0,
      volumeETH: 0,
      uniqueContracts: 0,
      activeDays: 0,
      dexTrades: 0,
      nftMints: 0,
      firstSeenBlock: blockNumber || 0,
    };
    // Derive ISO timestamp for asOf. Prefer the block timestamp, else now.
    const asOfDate = timeAnchor.blockTimestamp
      ? new Date(timeAnchor.blockTimestamp * 1000)
      : new Date(timeAnchor.nowUnix * 1000);
    // Construct canonical stats JSON with sorted keys
    const statsJson = {
      address,
      asOf: asOfDate.toISOString(),
      window: 'since_base_launch',
      metrics,
    };
    const canonical = canonicalJson(statsJson);
    const statsHash = toKeccakHex(canonical);
    res.status(200).json({ timeAnchor, statsJson, statsHash });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
