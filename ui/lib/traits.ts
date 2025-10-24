// Trait selection logic based on wallet metrics and configuration.

import cfg from '../config/anime-cyberpunk.json';
import { WalletInput, LayerResult, TraitPick, LayerNames } from './types';
import { geneGender, backgroundName } from './rules';

/**
 * Look up a trait within a layer by name. Returns undefined if the layer
 * or trait cannot be found in the configuration. This function assumes
 * a flat structure of layers with buckets containing a `trait` property.
 */
function findTrait(layerName: string, traitName: string): TraitPick | undefined {
  const layer = (cfg as any).layers.find((l: any) => l.name === layerName);
  if (!layer) return undefined;
  const bucket = (layer.buckets as any[]).find((b: any) => b.trait?.name === traitName);
  return bucket?.trait;
}

/**
 * Select a trait based on a numeric value and defined ranges. Buckets in the
 * config specify `min` and `max` values; the first bucket matching the
 * provided value (inclusive) is returned. If no bucket matches, fall back
 * to the last bucket in the layer.
 */
function pickByRanges(layerName: string, value: number): string {
  const layer = (cfg as any).layers.find((l: any) => l.name === layerName);
  if (!layer) return '';
  for (const b of layer.buckets as any[]) {
    const min = b.min ?? Number.MIN_SAFE_INTEGER;
    const max = b.max ?? Number.MAX_SAFE_INTEGER;
    if (value >= min && value <= max) return b.trait.name;
  }
  const last = layer.buckets[layer.buckets.length - 1];
  return last?.trait?.name ?? '';
}

/**
 * Count how many layers have top-tier traits. A top-tier trait is the last
 * bucket defined in the configuration for that layer. This is used to
 * determine whether an optional Signature layer should be included.
 */
function countTopTiers(layerNames: Record<string, string>): number {
  let count = 0;
  for (const layer of Object.keys(layerNames)) {
    const configLayer = (cfg as any).layers.find((l: any) => l.name === layer);
    if (!configLayer || !Array.isArray(configLayer.buckets)) continue;
    const last = configLayer.buckets[configLayer.buckets.length - 1];
    if (last?.trait?.name === layerNames[layer]) count++;
  }
  return count;
}

/**
 * Convert a wallet input into selected trait picks and names. The selection
 * uses heuristics: gender gene from birth month, ranges for metrics, and
 * bitwise logic for NFTs. A signature trait may be added based on the
 * number of top-tier picks chosen across other layers.
 */
export function pickTraits(w: WalletInput): { traits: LayerResult; names: LayerNames } {
  const names: LayerNames = {};
  const traits: LayerResult = {};

  // Background selection based on NFT holdings
  const bgName = backgroundName(!!w.holds_builder, !!w.holds_introduced);
  names['Background'] = bgName;
  traits['Background'] = findTrait('Background', bgName);

  // Body selection based on gender gene
  const gender = geneGender(w.wallet_birth_month);
  const bodyName = gender === 'Male' ? 'Male' : 'Female';
  names['Body'] = bodyName;
  traits['Body'] = findTrait('Body', bodyName);

  // Headwear based on unique contracts
  names['Headwear'] = pickByRanges('Headwear', w.unique_contracts ?? 0);
  traits['Headwear'] = findTrait('Headwear', names['Headwear']);

  // Eyes based on active days
  names['Eyes'] = pickByRanges('Eyes', w.active_days ?? 0);
  traits['Eyes'] = findTrait('Eyes', names['Eyes']);

  // Clothing based on total transactions
  names['Clothing'] = pickByRanges('Clothing', w.total_txs ?? 0);
  traits['Clothing'] = findTrait('Clothing', names['Clothing']);

  // Accessory based on distinct tokens
  names['Accessory'] = pickByRanges('Accessory', w.distinct_tokens ?? 0);
  traits['Accessory'] = findTrait('Accessory', names['Accessory']);

  // Aura based on wallet age days
  names['Aura'] = pickByRanges('Aura', w.wallet_age_days ?? 0);
  traits['Aura'] = findTrait('Aura', names['Aura']);

  // Emblem based on dex trades and nft mints
  const trad = w.dex_trades ?? 0;
  const mints = w.nft_mints ?? 0;
  let emblemName = 'Null Band';
  if (trad + mints >= 100) emblemName = 'Prime Insignia';
  else if (trad + mints >= 20) emblemName = 'Core Sigil';
  else if (trad + mints >= 5) emblemName = 'Pulse Mark';
  names['Emblem'] = emblemName;
  traits['Emblem'] = findTrait('Emblem', emblemName);

  // Optional signature based on number of top-tier picks
  const topCount = countTopTiers(names);
  if (topCount >= 5) {
    names['Signature'] = 'Prime Forge';
    traits['Signature'] = findTrait('Signature', 'Prime Forge');
  } else if (topCount >= 3) {
    names['Signature'] = 'Foundry Seal';
    traits['Signature'] = findTrait('Signature', 'Foundry Seal');
  }

  return { traits, names };
}