// lib/species.ts
export type SpeciesId = 'fox' | 'owl' | 'dolphin' | 'panda';

const NIBBLE_GROUPS: Record<SpeciesId, string[]> = {
  fox:     ['0','4','8','c'],
  owl:     ['1','5','9','d'],
  dolphin: ['2','6','a','e'],
  panda:   ['3','7','b','f'],
};

export function pickSpeciesByNibble(address: string): SpeciesId {
  const a = (address || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) return 'fox';
  const nibble = a[2];
  for (const [species, group] of Object.entries(NIBBLE_GROUPS)) {
    if (group.includes(nibble)) return species as SpeciesId;
  }
  return 'fox';
}

export const SPECIES_STYLE: Record<SpeciesId, {
  baseName: string;
  camera: 'bust_3q';
  bgLock: 'brand_orb_v1';
  paletteHint: string;
}> = {
  fox:     { baseName: 'Fox',     camera: 'bust_3q', bgLock: 'brand_orb_v1', paletteHint: 'Base-blue & platinum' },
  owl:     { baseName: 'Owl',     camera: 'bust_3q', bgLock: 'brand_orb_v1', paletteHint: 'Base-blue & platinum' },
  dolphin: { baseName: 'Dolphin', camera: 'bust_3q', bgLock: 'brand_orb_v1', paletteHint: 'Base-blue & platinum' },
  panda:   { baseName: 'Panda',   camera: 'bust_3q', bgLock: 'brand_orb_v1', paletteHint: 'Base-blue & platinum' },
};
