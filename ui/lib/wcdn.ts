// lib/wcdn.ts
export function isHexAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// repo name is: wallets-<first-nibble after 0x>
export function walletRepoName(addr: string): string {
  const a = addr.toLowerCase();
  return `wallets-${a[2]}`; // e.g. 0xd... -> wallets-d
}

// path inside repo: <first-two-nibbles>/<address>.json  e.g. da/0x....json
export function walletRepoPath(addr: string): string {
  const a = addr.toLowerCase();
  const p2 = a.slice(2, 4); // first 2 hex chars
  return `${p2}/${a}.json`;
}

export function rawGithubUrl(owner: string, addr: string): string {
  const repo = walletRepoName(addr);
  const path = walletRepoPath(addr);
  // raw content URL
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
}
