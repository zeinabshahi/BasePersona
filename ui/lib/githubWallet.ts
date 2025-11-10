// Resolve GitHub path for a wallet JSON and fetch it

export type WalletJson = {
  wallet: string
  rank?: number
  lifetime?: {
    months_active?: number
    first?: string
    last?: string
    tx_sum?: number
    uniq_sum?: number
    trade_sum?: number
    nft_sum?: number
    gas_sum?: number
    gas_sum_filled?: number
    avg_balance_eth_mean?: number
    streak_best_days?: number
  }
  months: Record<string, {
    txs?: number
    uniq?: number
    trade?: number
    nft?: number
    gas?: number
    bal?: number
    days?: number
    spread?: number
    streak?: number
    rank_m?: number
    pct_m?: number
    gas_method?: string
  }>
};

export function buildGitHubWalletUrl(addr: string, opts?: {
  user?: string
  repoPrefix?: string   // default: "wallets-"
  branch?: string       // default: "main"
}): string {
  const user   = opts?.user ?? process.env.WALLETS_GH_USER   ?? 'zeinabshahi';
  const branch = opts?.branch ?? process.env.WALLETS_GH_BRANCH ?? 'main';
  const pref   = opts?.repoPrefix ?? process.env.WALLETS_GH_PREFIX ?? 'wallets-';

  const a = addr.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) throw new Error('bad address');

  const h1 = a[2];           // e.g. "6"
  const h2 = a[3];           // e.g. "3"
  const repo   = `${pref}${h1}`;    // wallets-6
  const folder = `${h1}${h2}`;      // 63
  return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${folder}/${a}.json`;
}

export async function fetchWalletJson(addr: string): Promise<WalletJson> {
  const url = buildGitHubWalletUrl(addr);
  const r = await fetch(url);
  if (!r.ok) {
    const msg = `github ${r.status} for ${url}`;
    throw new Error(msg);
  }
  return await r.json() as WalletJson;
}
