// lib/githubWallet.ts

export type WalletJsonMonth = {
  txs?: number;          // transactions in that month
  uniq?: number;         // unique contracts
  trade?: number;        // swap/trade tx count
  nft?: number;          // nft unique contracts (or mints)
  gas?: number;          // gas (ETH)
  bal?: number;          // avg balance (ETH)
  days?: number;         // active unique days
  spread?: number;       // not used by UI
  streak?: number;       // best streak in days (within month)
  rank_m?: number;       // monthly rank (lower is better)
  pct_m?: number;        // monthly percentile (0..1)
  [k: string]: unknown;
};

export type WalletJson = {
  wallet: string;
  rank?: number; // overall rank (lifetime)
  lifetime?: {
    months_active?: number;
    first?: string;
    last?: string;
    tx_sum?: number;
    uniq_sum?: number;
    trade_sum?: number;
    nft_sum?: number;
    gas_sum?: number;
    avg_balance_eth_mean?: number;
    streak_best_days?: number;
    gas_sum_filled?: number;
  };
  months: Record<string, WalletJsonMonth>; // "YYYY-MM" -> row
};

// Simple in-memory cache to reduce repeated GitHub fetches
const mem = new Map<string, WalletJson>();

/**
 * Build the raw.githubusercontent.com URL for a given address
 * Repo layout assumed:
 *   repo: wallets-<first nibble>, e.g. wallets-6
 *   path: <first2>/<address>.json, e.g. 6a/0x6a....json
 */
function buildRawUrl(address: string, owner: string, branch: string) {
  const addr = address.toLowerCase();
  const nibble = addr[2];           // first hex after 0x
  const first2 = addr.slice(2, 4);  // e.g. "6a"
  const repo = `wallets-${nibble}`; // e.g. wallets-6
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${first2}/${addr}.json`;
}

/**
 * Fetch wallet JSON from GitHub (public repos).
 * Env overrides:
 *   WALLETS_GH_OWNER  (default: "zeinabshahi")
 *   WALLETS_GH_BRANCH (default: "main", fallback to "master")
 */
export async function fetchWalletJson(address: string): Promise<WalletJson> {
  const addr = address.toLowerCase();
  if (mem.has(addr)) return mem.get(addr)!;

  const owner  = process.env.WALLETS_GH_OWNER  ?? "zeinabshahi";
  const branch = process.env.WALLETS_GH_BRANCH ?? "main";

  const urls = [
    buildRawUrl(addr, owner, branch),
    // fallback to "master" if main doesn't exist
    buildRawUrl(addr, owner, "master"),
  ];

  let lastErr: any;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.ok) {
        const text = await r.text(); // be robust to wrong content-type
        const json = JSON.parse(text) as WalletJson;
        mem.set(addr, json);
        return json;
      }
      lastErr = new Error(`GitHub HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("wallet json not found");
}
