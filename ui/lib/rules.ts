// Utility functions for selecting traits based on wallet metrics.

/**
 * Determine the biological gender for the body layer based on the wallet's
 * birth month. Odd months map to "Male" and even months map to "Female". If
 * the month is undefined or not a valid number, default to "Male".
 *
 * @param month The wallet birth month (1–12)
 * @returns "Male" or "Female"
 */
export function geneGender(month?: number): 'Male' | 'Female' {
  if (!month || isNaN(month)) return 'Male';
  return month % 2 === 1 ? 'Male' : 'Female';
}

/**
 * Choose a background based on whether the wallet holds builder or introduced
 * NFTs. When holding both, choose "Dual Core"; when holding either, choose
 * "Builder Grid"; otherwise fallback to "Simple Blue".
 *
 * @param holdsBuilder Does the wallet hold the Base builder NFT?
 * @param holdsIntroduced Does the wallet hold the Base introduced NFT?
 */
export function backgroundName(
  holdsBuilder: boolean,
  holdsIntroduced: boolean
): 'Simple Blue' | 'Builder Grid' | 'Dual Core' {
  if (holdsBuilder && holdsIntroduced) return 'Dual Core';
  if (holdsBuilder || holdsIntroduced) return 'Builder Grid';
  return 'Simple Blue';
}