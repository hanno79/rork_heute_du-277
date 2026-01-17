/**
 * Security utilities for Convex functions
 *
 * These utilities implement timing-safe comparisons to prevent timing attacks
 * where an attacker could measure response times to infer secret values.
 */

/**
 * Timing-safe comparison of two byte arrays (Uint8Array)
 *
 * Uses XOR-based comparison that always takes the same amount of time
 * regardless of where the first difference occurs.
 *
 * @param a - First byte array to compare
 * @param b - Second byte array to compare
 * @returns true if arrays are equal, false otherwise
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  // If lengths differ, still do the comparison to maintain constant time
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Will be non-zero if lengths differ

  for (let i = 0; i < maxLen; i++) {
    // Use 0 as fallback for out-of-bounds access to maintain constant time
    const byteA = i < a.length ? a[i] : 0;
    const byteB = i < b.length ? b[i] : 0;
    result |= byteA ^ byteB;
  }

  return result === 0;
}

/**
 * Timing-safe comparison of two strings
 *
 * Uses XOR-based comparison that always takes the same amount of time
 * regardless of where the first difference occurs. Safely handles
 * null and undefined values by normalizing to empty strings.
 *
 * @param a - First string to compare (can be null/undefined)
 * @param b - Second string to compare (can be null/undefined)
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  // Normalize null/undefined to empty string
  const strA = a ?? '';
  const strB = b ?? '';

  // If lengths differ, still do the comparison to maintain constant time
  // but remember that the result should be false
  const lenA = strA.length;
  const lenB = strB.length;
  const maxLen = Math.max(lenA, lenB);

  let result = lenA ^ lenB; // Will be non-zero if lengths differ

  for (let i = 0; i < maxLen; i++) {
    // Use 0 as fallback for out-of-bounds access to maintain constant time
    const charA = i < lenA ? strA.charCodeAt(i) : 0;
    const charB = i < lenB ? strB.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}
