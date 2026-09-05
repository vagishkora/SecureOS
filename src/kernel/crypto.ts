// ─────────────────────────────────────────────────────────────
// SecureOS Kernel — Cryptographic Utilities
// ─────────────────────────────────────────────────────────────
// Thin wrappers around Web Crypto API. Shared by audit.ts,
// store.ts, and the future VFS integrity checks.
//
// IMPORTANT: canonicalize() sorts keys recursively before
// JSON.stringify. Without this, the same logical object could
// produce different hashes depending on property insertion order.
// ─────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of a string, returned as a lowercase hex string.
 *
 * Uses the Web Crypto API (`crypto.subtle.digest`), which is available in
 * all modern browsers and Node.js 20+.
 *
 * @example
 * await sha256('hello') // => '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert each byte to a 2-character hex string
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Produce a deterministic JSON string from an arbitrary value.
 *
 * Object keys are sorted recursively (depth-first) so that
 * `{b: 1, a: 2}` and `{a: 2, b: 1}` produce the same output.
 * Arrays preserve element order (they are not sorted — order matters).
 *
 * Why this matters:
 *   JSON.stringify does NOT guarantee key order across engines.
 *   If two logically-identical objects hash differently because
 *   their keys happen to be in a different insertion order,
 *   that's a subtle, intermittent bug that's nearly impossible
 *   to reproduce — exactly the kind of thing that destroys
 *   trust in an audit log.
 *
 * @example
 * canonicalize({ b: 1, a: { d: 3, c: 2 } })
 * // => '{"a":{"c":2,"d":3},"b":1}'
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/**
 * Recursively sort object keys. Arrays are traversed but their
 * element order is preserved (arrays are ordered collections).
 */
function sortKeys(value: unknown): unknown {
  // Null / primitives — return as-is
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  // Arrays — recurse into elements but preserve order
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  // Plain objects — sort keys alphabetically, recurse into values
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

// ─────────────────────────────────────────────────────────────
// Authentication & PBKDF2
// ─────────────────────────────────────────────────────────────

const AUTH_SALT = 'SecureOS_Phase3_Salt_2026';
const AUTH_ITERATIONS = 100000;
const AUTH_EXPECTED_PASSWORD = 'admin';

/**
 * Derives a PBKDF2 hash from a password string.
 */
export async function deriveLoginHash(password: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBuffer = new TextEncoder().encode(AUTH_SALT);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: AUTH_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Verifies if the provided password matches the system's hardcoded password.
 * (In a real system, the hash would be loaded from a secure vault or backend).
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const inputHash = await deriveLoginHash(password);
  const expectedHash = await deriveLoginHash(AUTH_EXPECTED_PASSWORD);
  return inputHash === expectedHash;
}
