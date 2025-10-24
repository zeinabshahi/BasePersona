import keccak256 from 'keccak256';

/**
 * Deeply sort the keys of an object for canonical JSON serialization. Arrays are
 * left intact; objects are sorted by key recursively. Non‑object values are
 * returned as‑is.
 *
 * @param obj Any JSON value
 */
function deepSort(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSort(item));
  }
  if (obj && typeof obj === 'object' && !Buffer.isBuffer(obj)) {
    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sorted[key] = deepSort(obj[key]);
      });
    return sorted;
  }
  return obj;
}

/**
 * Produce a canonical JSON string with sorted keys and no extra whitespace. Use
 * this before hashing structures for deterministic output.
 *
 * @param value The JSON object to stringify
 */
export function canonicalJson(value: any): string {
  return JSON.stringify(deepSort(value));
}

/**
 * Compute the keccak256 hash of a UTF‑8 encoded string and return a 0x‑prefixed
 * hex value.
 *
 * @param input String to hash
 */
export function toKeccakHex(input: string): string {
  const hash = keccak256(Buffer.from(input));
  return '0x' + hash.toString('hex');
}
