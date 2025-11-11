// lib/prompt.ts
/**
 * Deterministic, locked prompt builder for Base Persona images.
 * - Visual style is LOCKED (camera / lighting / background / composition / aspect).
 * - Only the SUBJECT varies via `species` (fox | dolphin | owl | panda).
 * - No HTML/tags in the prompt.
 */

export type SpeciesId = 'fox' | 'dolphin' | 'owl' | 'panda';

export type StyleLock = {
  camera?: string;        // e.g., "waist-up portrait"
  lighting?: string;      // e.g., "cinematic studio lighting"
  bg?: string;            // e.g., "brand_orb_v1" | free text
  composition?: string;   // e.g., "symmetrical composition"
  aspect?: string;        // e.g., "1:1 aspect ratio"
};

export type BuildPromptInput = {
  species?: SpeciesId | string;  // preferred: 'fox' | 'dolphin' | 'owl' | 'panda'
  styleLock?: StyleLock;         // locks for camera/lighting/bg/composition/aspect
  paletteId?: number;            // ignored here but kept for compat
  [key: string]: any;            // tolerate extra fields (traits/persona, etc.)
};

const SPECIES_CUES: Record<SpeciesId, string> = {
  fox:     'waist-up portrait of a stylized fox character (smart, agile, playful but focused)',
  dolphin: 'waist-up portrait of a stylized dolphin character (curious, precise, calm under pressure)',
  owl:     'waist-up portrait of a stylized owl character (observant, thoughtful, unflappable)',
  panda:   'waist-up portrait of a stylized panda character (steady, friendly, quietly determined)',
};

function normalizeSpecies(x?: string): SpeciesId {
  const s = (x || '').toLowerCase();
  if (s.includes('dolphin')) return 'dolphin';
  if (s.includes('owl'))     return 'owl';
  if (s.includes('panda'))   return 'panda';
  return 'fox';
}

function normalizeStyleLock(lock?: StyleLock) {
  const camera      = lock?.camera      || 'waist-up portrait';
  const lighting    = lock?.lighting    || 'cinematic studio lighting';
  const composition = lock?.composition || 'symmetrical composition';
  const aspect      = lock?.aspect      || '1:1 aspect ratio';

  // brand_orb_v1 → Base-blue orbital gradient with soft particles
  const bg = (() => {
    const k = (lock?.bg || '').toLowerCase();
    if (k === 'brand_orb_v1') return 'Base-blue orbital gradient background with soft particles';
    if (k) return k;
    return 'deep electric-blue gradient background';
  })();

  return { camera, lighting, composition, aspect, bg };
}

function clean(s: string): string {
  // remove any HTML artifacts and collapse whitespace
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Core builder (locked). */
function _buildLockedPrompt(traits: BuildPromptInput): string {
  const species = normalizeSpecies(
    traits?.species ||
    (traits as any)?.names?.species ||
    (traits as any)?.persona?.species
  );

  const cue = SPECIES_CUES[species];
  const { camera, lighting, composition, aspect, bg } = normalizeStyleLock(traits?.styleLock);

  const parts = [
    cue,                              // SUBJECT (only variable)
    'stylized 3D render',             // STYLE LOCK
    camera,                           // CAMERA LOCK
    lighting,                         // LIGHTING LOCK
    'ultra detailed, production-quality character render',
    bg,                               // BACKGROUND LOCK
    composition,                      // COMPOSITION LOCK
    aspect,                           // ASPECT LOCK
    'subtle Base-native energy, crisp edges, no text, no UI, no logos',
  ];

  return clean(parts.join(', '));
}

/* ---- Exports (backward compatible) ---- */
// Some modules import named `buildLockedPrompt`, others import named `buildPrompt`,
// and some use default import. Support all three.

export const buildLockedPrompt = _buildLockedPrompt;
export const buildPrompt = _buildLockedPrompt;       // alias for older callers
export default _buildLockedPrompt;
