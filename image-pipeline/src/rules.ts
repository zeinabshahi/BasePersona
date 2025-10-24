/**
 * Utility functions for trait selection.
 */

/**
 * Determine gender from a birth month.  Odd month → Male, even month → Female.  If month is undefined the default is Male.
 */
export function geneGender(month?: number): "Male" | "Female" {
  if (!month || isNaN(month)) return "Male";
  return month % 2 === 1 ? "Male" : "Female";
}

/**
 * Determine the background trait name based on NFT holdings.
 * If both NFTs are held, return 'Dual Core'; if exactly one is held, 'Builder Grid'; otherwise 'Simple Blue'.
 */
export function backgroundName(holdsA: boolean, holdsB: boolean): "Dual Core" | "Builder Grid" | "Simple Blue" {
  if (holdsA && holdsB) return "Dual Core";
  if (holdsA || holdsB) return "Builder Grid";
  return "Simple Blue";
}

/**
 * Generic tier picker.  Given a numeric value, a list of cutoff points and an array of names,
 * return the name corresponding to the bucket into which the value falls.
 */
export function pickTier<T>(value: number, stops: number[], names: T[]): T {
  const extended = [...stops, Number.POSITIVE_INFINITY];
  for (let i = 0; i < extended.length; i++) {
    const max = extended[i];
    if (value < max) {
      return names[i];
    }
  }
  return names[names.length - 1];
}

/**
 * Count how many of the given layer names are in their highest tiers.
 * The predicate is provided externally because the exact definition of "top tier" differs per layer.
 */
export function countTopTier(picks: Record<string, string>, isTop: (layer: string, trait: string) => boolean): number {
  let count = 0;
  for (const layer of Object.keys(picks)) {
    if (isTop(layer, picks[layer])) count++;
  }
  return count;
}