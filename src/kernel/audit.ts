// ─────────────────────────────────────────────────────────────
// SecureOS Kernel — Hash-Chained Audit Log
// ─────────────────────────────────────────────────────────────
// Every security-relevant action in the system is recorded here.
// Each entry includes a SHA-256 hash of the previous entry,
// creating a tamper-evident chain (like a mini blockchain).
//
// If an attacker modifies any entry, every subsequent hash
// becomes invalid — `verifyChain()` will detect the break.
//
// CONCURRENCY MODEL:
//   Hash chains are inherently sequential — entry N's hash
//   depends on entry N-1's hash. Concurrent `appendLog()` calls
//   would all read the same `previousHash`, corrupting the chain.
//   We serialize writes with an async queue (a promise chain).
//
//   `clearLog()` increments a generation counter so that
//   in-flight writes from a prior generation are silently
//   discarded — critical for test isolation.
//
// Phase 1: in-memory array.
// Future: persisted to IndexedDB via `idb`.
// ─────────────────────────────────────────────────────────────

import { sha256, canonicalize } from './crypto';
import type { AuditEntry, AuditEntryInput, ChainVerificationResult } from './types';
import { saveAuditEntry, loadAuditLog as loadFromDB, clearAuditLogDB } from './idb';

/** The genesis "previous hash" — 64 hex zeros (256 bits of nothing) */
const GENESIS_HASH = '0'.repeat(64);

/**
 * The in-memory audit log. Append-only during normal operation.
 * `clearLog()` exists solely for test isolation.
 */
let log: AuditEntry[] = [];

/**
 * Generation counter — incremented by `clearLog()`.
 * `appendLog()` captures the generation at call time and
 * discards the write if the generation changed during
 * the async SHA-256 computation. This prevents stale writes
 * from prior test suites from polluting the current log.
 */
let generation = 0;

/**
 * Async write queue — a promise chain that serializes all
 * `appendLog()` calls. Hash chains require sequential writes:
 * entry N must see entry N-1's hash before it can compute its own.
 */
let writeQueue: Promise<void> = Promise.resolve();

// ─────────────────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────────────────

/**
 * Append a new entry to the audit log.
 *
 * The caller provides the payload fields; this function fills in:
 *   - `id`           — via crypto.randomUUID()
 *   - `previousHash` — hash of the last entry (or GENESIS_HASH)
 *   - `hash`         — SHA-256 of the canonicalized entry
 *
 * Writes are serialized via an internal queue to maintain chain
 * integrity even when multiple callers fire concurrently
 * (e.g., `void appendLog(...)` in the kernel store).
 *
 * @returns The complete, hashed entry that was appended.
 */
export function appendLog(input: AuditEntryInput): Promise<AuditEntry> {
  const callGeneration = generation;

  // Each call creates its own promise that resolves when THIS entry is written.
  // The write queue ensures sequential processing.
  const entryPromise = new Promise<AuditEntry>((resolve) => {
    writeQueue = writeQueue.then(async () => {
      // If clearLog() was called after this write was enqueued,
      // discard it — it belongs to a prior generation.
      if (generation !== callGeneration) {
        resolve({} as AuditEntry); // caller likely doesn't await anyway
        return;
      }

      const lastEntry = log[log.length - 1];
      const previousHash = lastEntry ? lastEntry.hash : GENESIS_HASH;

      // Build the entry without its own hash (we need to hash everything else first)
      const entryWithoutHash: Omit<AuditEntry, 'hash'> = {
        id: crypto.randomUUID(),
        timestamp: input.timestamp,
        actor: input.actor,
        action: input.action,
        resource: input.resource,
        outcome: input.outcome,
        previousHash,
        // Only include `details` if it was provided (avoid phantom keys)
        ...(input.details !== undefined ? { details: input.details } : {}),
      };

      // Hash the canonicalized entry (key-sorted JSON)
      const hash = await sha256(canonicalize(entryWithoutHash));

      // Check generation again after the async SHA-256 gap
      if (generation !== callGeneration) {
        resolve({} as AuditEntry);
        return;
      }

      const entry: AuditEntry = { ...entryWithoutHash, hash };
      log.push(entry);
      
      // Save to IndexedDB asynchronously
      saveAuditEntry(entry).catch(err => console.error("Failed to persist audit log", err));
      
      resolve(entry);
    });
  });

  return entryPromise;
}

/**
 * Wait for all pending audit writes to complete.
 *
 * Use this instead of `setTimeout` hacks in tests. After `await flushLog()`,
 * every `void appendLog(...)` that was called before this point has either
 * written its entry or been discarded (if clearLog was called).
 */
export function flushLog(): Promise<void> {
  return writeQueue;
}

/**
 * Verify the integrity of the entire audit chain.
 *
 * Walks every entry and checks:
 *   1. The entry's `hash` matches a fresh SHA-256 of its contents.
 *   2. The entry's `previousHash` matches the prior entry's `hash`.
 *
 * @returns `{ valid: true }` if the chain is intact, or
 *          `{ valid: false, brokenAt, reason }` at the first break.
 */
export async function verifyChain(): Promise<ChainVerificationResult> {
  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;

    // ── Check 1: Does the stored hash match a fresh computation? ──
    const { hash: storedHash, ...rest } = entry;
    const recomputedHash = await sha256(canonicalize(rest));

    if (recomputedHash !== storedHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} hash mismatch: stored=${storedHash.slice(0, 16)}…, recomputed=${recomputedHash.slice(0, 16)}…`,
      };
    }

    // ── Check 2: Does previousHash point to the prior entry? ──
    const expectedPreviousHash = i === 0 ? GENESIS_HASH : log[i - 1]!.hash;
    if (entry.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} previousHash mismatch: expected=${expectedPreviousHash.slice(0, 16)}…, got=${entry.previousHash.slice(0, 16)}…`,
      };
    }
  }

  return { valid: true };
}

/**
 * Return an immutable snapshot of the current log.
 *
 * Note: The returned array is a shallow copy. The entries themselves
 * are not frozen — callers should treat them as read-only.
 * (In tests, we intentionally mutate entries to prove tamper detection.)
 */
export function getLog(): readonly AuditEntry[] {
  return [...log];
}

/**
 * Get the number of entries in the log.
 */
export function getLogLength(): number {
  return log.length;
}

/**
 * Get direct mutable access to the internal log array.
 *
 * ⚠️  FOR TESTING ONLY — used to simulate tampering.
 * In production, this function should not exist.
 */
export function _getInternalLogForTesting(): AuditEntry[] {
  return log;
}

/**
 * Clear the entire log. FOR TESTING ONLY.
 *
 * Resets the log to empty AND increments the generation counter
 * so that any in-flight writes from prior tests are discarded.
 * Also resets the write queue to prevent stale promise chains.
 */
export function clearLog(): void {
  log = [];
  generation++;
  writeQueue = Promise.resolve();
  clearAuditLogDB().catch(console.error);
}

export async function initAuditLog(): Promise<void> {
  log = await loadFromDB();
}
