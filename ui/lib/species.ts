// lib/species.ts
export type Species =
  | 'owl' | 'fox' | 'dolphin' | 'panda'
  | 'tiger' | 'wolf' | 'cat' | 'whale';

const SPECIES: Species[] = [
  'owl','fox','dolphin','panda','tiger','wolf','cat','whale'
];

export function pickSpeciesByNibble(addr: string): Species {
  const m = addr?.match(/^0x([0-9a-fA-F]{40})$/);
  if (!m) return 'owl';
  const last = m[1].slice(-1);
  const n = parseInt(last, 16);
  return SPECIES[n % SPECIES.length];
}
