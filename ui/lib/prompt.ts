// Build a final prompt string from selected traits and configuration.

import cfg from '../config/anime-cyberpunk.json';
import type { LayerResult } from './types';

/**
 * Construct the full image prompt by replacing placeholders defined in the
 * template with the corresponding trait prompts. If a placeholder does not
 * have a matching trait, it is replaced with an empty string. A
 * `signature_clause` placeholder is optional and included only when the
 * signature trait exists.
 *
 * @param layers Mapping of layer names to trait picks
 */
export function buildPrompt(layers: LayerResult): string {
  const template: string = (cfg as any).prompt_template;
  // Map placeholders to trait prompt snippets
  const map: Record<string, string> = {
    body: layers['Body']?.prompt ?? '',
    clothing: layers['Clothing']?.prompt ?? '',
    headwear: layers['Headwear']?.prompt ?? '',
    eyes: layers['Eyes']?.prompt ?? '',
    accessory: layers['Accessory']?.prompt ?? '',
    aura: layers['Aura']?.prompt ?? '',
    emblem: layers['Emblem']?.prompt ?? '',
    signature_clause: layers['Signature'] ? ', ' + layers['Signature']!.prompt : ''
  };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => map[key] ?? '');
}