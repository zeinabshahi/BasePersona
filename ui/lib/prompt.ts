// ui/lib/prompt.ts
/**
 * Deterministic image prompt builder for Base Persona.
 * - Visual style is fully LOCKED (camera / lighting / background / composition / aspect).
 * - Only the SUBJECT varies via `traits.species` (fox | dolphin | owl | panda).
 * - No HTML, no bold tags in the prompt.
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
  // typical fields we may receive from pickTraits / traitsJson
  species?: SpeciesId | string;
  styleLock?: StyleLock;
  // optional future hooks
  baseImageRef?: string;  // id/url of the base template (if your renderer supports reference images)
  paletteId?: number;
  [key: string]: any;
};

const SPECIES_CUES: Record<SpeciesId, string> = {
  fox:     "waist-up portrait of a stylized fox character (smart, agile, playful but focused)",
  dolphin: "waist-up portrait of a stylized dolphin character (curious, precise, calm under pressure)",
  owl:     "waist-up portrait of a stylized owl character (observant, thoughtful, unflappable)",
  panda:   "waist-up portrait of a stylized panda character (steady, friendly, quietly determined)",
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

  // brand_orb_v1 = our Base-blue orbital gradient w/ soft particles
  const bg = (() => {
    const k = (lock?.bg || '').toLowerCase();
    if (k === 'brand_orb_v1') return 'Base-blue orbital gradient background with soft particles';
    if (k) return k;
    return 'deep electric-blue gradient background';
  })();

  return { camera, lighting, composition, aspect, bg };
}

function clean(s: string): string {
  // avoid any HTML artifacts
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build a single locked prompt string.
 * If you want to pass reference images to your renderer, do it in your image layer;
 * here we only write plain-text guidance (no IDs are assumed).
 */
export function buildPrompt(traits: BuildPromptInput): string {
  const species = normalizeSpecies(
    // try several known locations where species might live
    (traits as any)?.species
      || (traits as any)?.names?.species
      || (traits as any)?.persona?.species
  ) as SpeciesId;

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
    // brand tone (kept subtle; avoids leaking specific visual props)
    'subtle Base-native energy, crisp edges, no text, no UI, no logos',
  ];

  return clean(parts.join(', '));
}

// optional default export to be extra-safe with imports
export default buildPrompt;
