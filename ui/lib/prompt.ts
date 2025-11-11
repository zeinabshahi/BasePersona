// lib/prompt.ts
import type { SpeciesId } from './species';
import { SPECIES_STYLE } from './species';

type BuildPromptIn = {
  species: SpeciesId;
  traitsJson?: any;
  persona?: any;
};

export function buildLockedPrompt({ species, traitsJson, persona }: BuildPromptIn) {
  const ss = SPECIES_STYLE[species];
  const stage = traitsJson?.stage || 'adult';
  const tier  = traitsJson?.tier  ?? 0;

  const vibe =
    persona?.tone === 'hype' ? 'confident, energetic but tasteful' :
    persona?.tone === 'builderish' ? 'calm, thoughtful, ship-first' :
    'curious, steady';

  const archetype =
    (persona?.archetype || '').toString().toLowerCase() ||
    (Array.isArray(persona?.traitsText) ? (persona.traitsText[0] || '') : '') ||
    'explorer';

  // Locked style + identity guard; model should preserve species identity from reference
  const lines = [
    `Base-native portrait, ${ss.camera} angle, symmetrical composition.`,
    `Clean studio lighting, ultra-detailed, ${ss.paletteHint}.`,
    `Subject: the ${ss.baseName} persona (keep silhouette and facial identity close to reference).`,
    `Overall vibe: ${vibe}; archetype hint: ${archetype}.`,
    `Stage hint: ${stage}; tier hint: ${tier}.`,
    `Do not change species or camera; avoid clutter; tasteful UI glow allowed.`,
  ];

  return lines.join(' ');
}
