// ─────────────────────────────────────────────────────────────
// SecureOS — Crypto Utilities Tests
// ─────────────────────────────────────────────────────────────
// Tests for SHA-256 hashing and deterministic canonicalization.
// These are the primitives the audit log depends on — if they're
// wrong, everything downstream is wrong.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { sha256, canonicalize } from '../crypto';

describe('sha256', () => {
  it('produces a 64-character hex string', async () => {
    const hash = await sha256('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent output for the same input', async () => {
    const hash1 = await sha256('test input');
    const hash2 = await sha256('test input');
    expect(hash1).toBe(hash2);
  });

  it('produces different output for different inputs', async () => {
    const hash1 = await sha256('input A');
    const hash2 = await sha256('input B');
    expect(hash1).not.toBe(hash2);
  });

  it('matches known SHA-256 test vector', async () => {
    // NIST test vector: SHA-256('abc')
    const hash = await sha256('abc');
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('handles empty string', async () => {
    const hash = await sha256('');
    // SHA-256('') is well-known
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('canonicalize', () => {
  it('sorts object keys alphabetically', () => {
    const result = canonicalize({ b: 1, a: 2 });
    expect(result).toBe('{"a":2,"b":1}');
  });

  it('produces identical output regardless of key insertion order', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, m: 3, z: 1 };
    const obj3 = { m: 3, z: 1, a: 2 };
    const c1 = canonicalize(obj1);
    const c2 = canonicalize(obj2);
    const c3 = canonicalize(obj3);
    expect(c1).toBe(c2);
    expect(c2).toBe(c3);
  });

  it('handles nested objects — sorts keys at every depth', () => {
    const result = canonicalize({
      b: { d: 4, c: 3 },
      a: { f: 6, e: 5 },
    });
    expect(result).toBe('{"a":{"e":5,"f":6},"b":{"c":3,"d":4}}');
  });

  it('preserves array element order (arrays are ordered collections)', () => {
    const result = canonicalize({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it('handles arrays of objects — sorts keys within each element', () => {
    const result = canonicalize([
      { b: 1, a: 2 },
      { d: 4, c: 3 },
    ]);
    expect(result).toBe('[{"a":2,"b":1},{"c":3,"d":4}]');
  });

  it('handles primitives', () => {
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(null)).toBe('null');
  });

  it('handles deeply nested structures', () => {
    const deep = {
      c: {
        f: {
          h: 1,
          g: 2,
        },
        e: 3,
      },
      a: 4,
      b: [{ z: 1, y: 2 }],
    };
    const result = canonicalize(deep);
    expect(result).toBe('{"a":4,"b":[{"y":2,"z":1}],"c":{"e":3,"f":{"g":2,"h":1}}}');
  });
});

describe('sha256 + canonicalize integration', () => {
  it('same logical object produces same hash regardless of key order', async () => {
    const obj1 = { action: 'login', user: 'admin', timestamp: 12345 };
    const obj2 = { timestamp: 12345, action: 'login', user: 'admin' };
    const obj3 = { user: 'admin', timestamp: 12345, action: 'login' };

    const hash1 = await sha256(canonicalize(obj1));
    const hash2 = await sha256(canonicalize(obj2));
    const hash3 = await sha256(canonicalize(obj3));

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });
});
