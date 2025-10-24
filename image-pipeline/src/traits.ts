import configData from "../config/anime-cyberpunk.json" assert { type: "json" };
import { WalletInput, LayerResult, TraitPick } from "./types.js";
import { geneGender, backgroundName } from "./rules.js";

const cfg = configData as any;

/**
 * Helper to locate a trait definition by layer and trait name.  Returns undefined if the layer or trait is not found.
 */
function findTrait(layerName: string, traitName: string): TraitPick | undefined {
  const layer = cfg.layers.find((l: any) => l.name === layerName);
  if (!layer) return undefined;
  const bucket = (layer.buckets as any[]).find((b: any) => b.trait?.name === traitName);
  return bucket?.trait;
}

/**
 * Compute how many layers are at their highest tier.  The highest tier is defined as the last bucket in each layer array.
 */
function countTopTiers(layerNames: Record<string, string>): number {
  let count = 0;
  for (const layer of Object.keys(layerNames)) {
    const configLayer = cfg.layers.find((l: any) => l.name === layer);
    if (!configLayer || !Array.isArray(configLayer.buckets)) continue;
    const last = configLayer.buckets[configLayer.buckets.length - 1];
    if (last?.trait?.name === layerNames[layer]) count++;
  }
  return count;
}

/**
 * Given a wallet input, determine trait names and prompts for each layer.  Both the trait names and full trait objects are returned.
 */
export function pickTraits(w: WalletInput): { traits: LayerResult; names: Record<string, string> } {
  const names: Record<string, string> = {};
  const traits: LayerResult = {};

  // Background is not rendered here but recorded for metadata
  names["Background"] = backgroundName(w.holds_base_introduced, w.holds_base_builder);

  // Body (gender)
  const genderName = geneGender(w.wallet_birth_month);
  names["Body"] = genderName;
  traits["Body"] = findTrait("Body", genderName);

  // Aura
  const age = w.wallet_age_days ?? 1;
  let auraName: string;
  if (age < 100) auraName = "Genesis Spark";
  else if (age < 200) auraName = "Settler";
  else if (age < 300) auraName = "Pathfinder";
  else if (age < 500) auraName = "Veteran";
  else if (age < 800) auraName = "Ancient";
  else auraName = "Relic";
  names["Aura"] = auraName;
  traits["Aura"] = findTrait("Aura", auraName);

  // Headwear (unique contracts)
  const uc = w.unique_contracts;
  let headwearName: string;
  if (uc >= 500) headwearName = "Omni Headdress";
  else if (uc >= 200) headwearName = "Vanguard Helmet";
  else if (uc >= 100) headwearName = "Pro Visor";
  else if (uc >= 50) headwearName = "Multi-Tool Cap";
  else if (uc >= 10) headwearName = "Field Beanie";
  else headwearName = "Rookie Hair";
  names["Headwear"] = headwearName;
  traits["Headwear"] = findTrait("Headwear", headwearName);

  // Eyes (active days)
  const ad = w.active_days;
  let eyesName: string;
  if (ad >= 250) eyesName = "Full AR Visor";
  else if (ad >= 100) eyesName = "HUD Visor";
  else if (ad >= 50) eyesName = "Tech Specs";
  else if (ad >= 30) eyesName = "Tinted Glasses";
  else if (ad >= 10) eyesName = "Clear Glasses";
  else eyesName = "Bare Eyes";
  names["Eyes"] = eyesName;
  traits["Eyes"] = findTrait("Eyes", eyesName);

  // Clothing (total transactions)
  const tx = w.total_txs;
  let clothingName: string;
  if (tx >= 1000) clothingName = "Mythic Plate";
  else if (tx >= 500) clothingName = "Composite Suit";
  else if (tx >= 200) clothingName = "Alloy Armor";
  else if (tx >= 100) clothingName = "Leather Vest";
  else if (tx >= 50) clothingName = "Canvas Jacket";
  else clothingName = "Linen Tee";
  names["Clothing"] = clothingName;
  traits["Clothing"] = findTrait("Clothing", clothingName);

  // Accessory (distinct tokens)
  const dt = w.distinct_tokens;
  let accessoryName: string;
  if (dt >= 100) accessoryName = "Spectrum Ornaments";
  else if (dt >= 50) accessoryName = "Prism Mesh Harness";
  else if (dt >= 25) accessoryName = "Kaleido Bandolier";
  else if (dt >= 10) accessoryName = "Mosaic Pendant";
  else if (dt >= 3) accessoryName = "Dual Weave Scarf";
  else accessoryName = "Mono Stripe Pin";
  names["Accessory"] = accessoryName;
  traits["Accessory"] = findTrait("Accessory", accessoryName);

  // Emblem (volume ETH)
  const vol = w.volume_eth;
  let emblemName: string;
  if (vol >= 5) emblemName = "Platinum Halo";
  else if (vol >= 1) emblemName = "Gold Diadem";
  else if (vol >= 0.5) emblemName = "Silver Crest";
  else if (vol >= 0.1) emblemName = "Bronze Circlet";
  else if (vol >= 0.01) emblemName = "Tin Ring";
  else emblemName = "Null Band";
  names["Emblem"] = emblemName;
  traits["Emblem"] = findTrait("Emblem", emblemName);

  // Signature (optional)
  const topCount = countTopTiers(names);
  if (topCount >= 5) {
    names["Signature"] = "Prime Forge";
    traits["Signature"] = findTrait("Signature", "Prime Forge");
  } else if (topCount >= 3) {
    names["Signature"] = "Foundry Seal";
    traits["Signature"] = findTrait("Signature", "Foundry Seal");
  }
  return { traits, names };
}