// ─────────────────────────────────────────────────────────────
// SecureOS — Kernel Store + Audit Log Tests
// ─────────────────────────────────────────────────────────────
// These tests prove two critical security properties:
//   1. An app without a declared capability is DENIED.
//   2. Tampering with a stored log entry is DETECTABLE.
//
// If these tests pass, the kernel's permission model and audit
// trail are trustworthy. Everything else in SecureOS builds
// on top of these guarantees.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { createKernelStore } from '../store';
import type { KernelStore } from '../store';
import type { AppManifest } from '../types';
import {
  appendLog,
  flushLog,
  verifyChain,
  getLog,
  getLogLength,
  clearLog,
  _getInternalLogForTesting,
} from '../audit';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

/** A file explorer that can read and write the filesystem */
const fileExplorerManifest: AppManifest = {
  appId: 'file-explorer',
  name: 'File Explorer',
  capabilities: ['fs:read', 'fs:write'],
};

/** A calculator with NO capabilities (pure computation) */
const calculatorManifest: AppManifest = {
  appId: 'calculator',
  name: 'Calculator',
  capabilities: [],
};

/** A terminal with broad capabilities */
const terminalManifest: AppManifest = {
  appId: 'terminal',
  name: 'Terminal',
  capabilities: ['fs:read', 'fs:write', 'fs:execute', 'system:process'],
};

/** An AI assistant with query-only access */
const assistantManifest: AppManifest = {
  appId: 'ai-assistant',
  name: 'AI Assistant',
  capabilities: ['assistant:query', 'fs:read'],
};

// ─────────────────────────────────────────────────────────────
// Note: We use `flushLog()` from audit.ts to await all pending
// fire-and-forget audit writes. No more brittle setTimeout hacks.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Permission Enforcement Tests
// ─────────────────────────────────────────────────────────────

describe('Kernel Store — Capability Enforcement', () => {
  let store: ReturnType<typeof createKernelStore>;
  let kernel: KernelStore;

  beforeEach(() => {
    clearLog();
    store = createKernelStore();
    kernel = store.getState();
  });

  // ── The two REQUIRED tests ──

  it('GRANTS access when capability IS declared in manifest', () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    const granted = kernel.requestCapability('file-explorer', 'fs:read');
    expect(granted).toBe(true);
  });

  it('DENIES access when capability is NOT declared in manifest', () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    // file-explorer has ['fs:read', 'fs:write'] — NOT 'network'
    const granted = kernel.requestCapability('file-explorer', 'network');
    expect(granted).toBe(false);
  });

  // ── Additional permission tests ──

  it('denies ALL capabilities for an unregistered app', () => {
    // 'ghost-app' was never registered
    const granted = kernel.requestCapability('ghost-app', 'fs:read');
    expect(granted).toBe(false);
  });

  it('denies ALL capabilities for an app with empty capabilities', () => {
    kernel.registerApp(calculatorManifest);
    kernel = store.getState();

    const results = [
      kernel.requestCapability('calculator', 'fs:read'),
      kernel.requestCapability('calculator', 'network'),
      kernel.requestCapability('calculator', 'clipboard'),
    ];
    expect(results).toEqual([false, false, false]);
  });

  it('grants only declared capabilities, denies the rest', () => {
    kernel.registerApp(assistantManifest);
    kernel = store.getState();

    // Declared: assistant:query, fs:read
    expect(kernel.requestCapability('ai-assistant', 'assistant:query')).toBe(true);
    expect(kernel.requestCapability('ai-assistant', 'fs:read')).toBe(true);

    // Not declared
    expect(kernel.requestCapability('ai-assistant', 'assistant:control')).toBe(false);
    expect(kernel.requestCapability('ai-assistant', 'fs:write')).toBe(false);
    expect(kernel.requestCapability('ai-assistant', 'network')).toBe(false);
  });

  it('audits every capability check — granted', async () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    kernel.requestCapability('file-explorer', 'fs:read');
    await flushLog();

    const log = getLog();
    const grantEntry = log.find(
      (e) => e.action === 'capability:grant' && e.resource === 'fs:read'
    );
    expect(grantEntry).toBeDefined();
    expect(grantEntry!.actor).toBe('file-explorer');
    expect(grantEntry!.outcome).toBe('granted');
  });

  it('audits every capability check — denied', async () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    kernel.requestCapability('file-explorer', 'network');
    await flushLog();

    const log = getLog();
    const denyEntry = log.find(
      (e) => e.action === 'capability:deny' && e.resource === 'network'
    );
    expect(denyEntry).toBeDefined();
    expect(denyEntry!.actor).toBe('file-explorer');
    expect(denyEntry!.outcome).toBe('denied');
  });
});

// ─────────────────────────────────────────────────────────────
// Process Management Tests
// ─────────────────────────────────────────────────────────────

describe('Kernel Store — Process Management', () => {
  let store: ReturnType<typeof createKernelStore>;
  let kernel: KernelStore;

  beforeEach(() => {
    clearLog();
    store = createKernelStore();
    kernel = store.getState();
  });

  it('launches a process with a unique, incrementing PID', () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    const p1 = kernel.launchProcess('file-explorer', 'win-1');
    kernel = store.getState();
    const p2 = kernel.launchProcess('file-explorer', 'win-2');

    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p1!.pid).toBe(1);
    expect(p2!.pid).toBe(2);
    expect(p1!.status).toBe('running');
  });

  it('returns null when launching an unregistered app', () => {
    const p = kernel.launchProcess('nonexistent', 'win-1');
    expect(p).toBeNull();
  });

  it('terminates a running process', () => {
    kernel.registerApp(fileExplorerManifest);
    kernel = store.getState();

    const p = kernel.launchProcess('file-explorer', 'win-1');
    kernel = store.getState();

    kernel.terminateProcess(p!.pid);
    kernel = store.getState();

    const terminated = kernel.processes.get(p!.pid);
    expect(terminated).toBeDefined();
    expect(terminated!.status).toBe('terminated');
  });

  it('tracks multiple simultaneous processes', () => {
    kernel.registerApp(fileExplorerManifest);
    kernel.registerApp(terminalManifest);
    kernel = store.getState();

    kernel.launchProcess('file-explorer', 'win-1');
    kernel.launchProcess('terminal', 'win-2');
    kernel = store.getState();

    expect(kernel.processes.size).toBe(2);
    const appIds = [...kernel.processes.values()].map((p) => p.appId);
    expect(appIds).toContain('file-explorer');
    expect(appIds).toContain('terminal');
  });
});

// ─────────────────────────────────────────────────────────────
// Focus Stack Tests
// ─────────────────────────────────────────────────────────────

describe('Kernel Store — Focus Stack', () => {
  let store: ReturnType<typeof createKernelStore>;
  let kernel: KernelStore;

  beforeEach(() => {
    clearLog();
    store = createKernelStore();
    kernel = store.getState();
  });

  it('moves focused window to the top of the stack', () => {
    kernel.focusWindow('win-1');
    kernel.focusWindow('win-2');
    kernel.focusWindow('win-3');
    kernel = store.getState();

    // win-3 is on top (last in array)
    expect(kernel.focusStack).toEqual(['win-1', 'win-2', 'win-3']);

    // Now focus win-1 — it should move to top
    kernel.focusWindow('win-1');
    kernel = store.getState();
    expect(kernel.focusStack).toEqual(['win-2', 'win-3', 'win-1']);
  });

  it('deduplicates windows in the stack', () => {
    kernel.focusWindow('win-1');
    kernel.focusWindow('win-1');
    kernel.focusWindow('win-1');
    kernel = store.getState();

    expect(kernel.focusStack).toEqual(['win-1']);
  });

  it('returns correct z-index', () => {
    kernel.focusWindow('win-a');
    kernel.focusWindow('win-b');
    kernel.focusWindow('win-c');
    kernel = store.getState();

    expect(kernel.getZIndex('win-a')).toBe(0);
    expect(kernel.getZIndex('win-b')).toBe(1);
    expect(kernel.getZIndex('win-c')).toBe(2); // highest = focused
    expect(kernel.getZIndex('nonexistent')).toBe(-1);
  });

  it('removes window from the stack', () => {
    kernel.focusWindow('win-1');
    kernel.focusWindow('win-2');
    kernel = store.getState();

    kernel.removeWindow('win-1');
    kernel = store.getState();

    expect(kernel.focusStack).toEqual(['win-2']);
  });
});

// ─────────────────────────────────────────────────────────────
// Hash-Chained Audit Log Tests
// ─────────────────────────────────────────────────────────────

describe('Audit Log — Hash Chain Integrity', () => {
  beforeEach(() => {
    clearLog();
  });

  it('genesis entry has previousHash of 64 zeros', async () => {
    await appendLog({
      timestamp: Date.now(),
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });

    const log = getLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.previousHash).toBe('0'.repeat(64));
  });

  it('each entry\'s previousHash matches the prior entry\'s hash', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 2000,
      actor: 'file-explorer',
      action: 'fs:read',
      resource: '/home/docs',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 3000,
      actor: 'terminal',
      action: 'capability:grant',
      resource: 'fs:execute',
      outcome: 'granted',
    });

    const log = getLog();
    expect(log).toHaveLength(3);

    // Entry 1's previousHash = Entry 0's hash
    expect(log[1]!.previousHash).toBe(log[0]!.hash);
    // Entry 2's previousHash = Entry 1's hash
    expect(log[2]!.previousHash).toBe(log[1]!.hash);
  });

  it('verifyChain returns valid for an untampered log', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 2000,
      actor: 'vault',
      action: 'fs:read',
      resource: '/vault/secrets',
      outcome: 'success',
    });

    const result = await verifyChain();
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  it('DETECTS tampering when a stored entry\'s payload is modified', async () => {
    // Build a 3-entry chain
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 2000,
      actor: 'file-explorer',
      action: 'fs:read',
      resource: '/home/docs/secret.txt',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 3000,
      actor: 'terminal',
      action: 'fs:write',
      resource: '/home/docs/output.txt',
      outcome: 'success',
    });

    // Verify it's clean
    let result = await verifyChain();
    expect(result.valid).toBe(true);

    // ── TAMPER: change entry 1's resource ──
    const internalLog = _getInternalLogForTesting();
    internalLog[1]!.resource = '/home/docs/HACKED.txt';

    // Verify the chain is now broken
    result = await verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.reason).toContain('hash mismatch');
  });

  it('DETECTS tampering when an entry\'s hash field is replaced', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 2000,
      actor: 'vault',
      action: 'fs:read',
      resource: '/vault/secrets',
      outcome: 'success',
    });

    // ── TAMPER: replace entry 0's hash with garbage ──
    const internalLog = _getInternalLogForTesting();
    internalLog[0]!.hash = 'deadbeef'.repeat(8);

    const result = await verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('DETECTS tampering when an entry is inserted into the middle', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 3000,
      actor: 'terminal',
      action: 'fs:write',
      resource: '/tmp/test.txt',
      outcome: 'success',
    });

    // ── TAMPER: splice a fake entry between 0 and 1 ──
    const internalLog = _getInternalLogForTesting();
    const fakeEntry = {
      id: 'fake-id',
      timestamp: 2000,
      actor: 'attacker',
      action: 'fs:delete' as const,
      resource: '/etc/passwd',
      outcome: 'success' as const,
      previousHash: internalLog[0]!.hash,
      hash: 'aaaa'.repeat(16),
    };
    internalLog.splice(1, 0, fakeEntry);

    const result = await verifyChain();
    expect(result.valid).toBe(false);
    // The fake entry at index 1 will have a mismatched hash
    expect(result.brokenAt).toBe(1);
  });

  it('empty log verifies as valid', async () => {
    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });

  it('each entry gets a unique UUID', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
    });
    await appendLog({
      timestamp: 2000,
      actor: 'system',
      action: 'auth:logout',
      resource: 'user:admin',
      outcome: 'success',
    });

    const log = getLog();
    expect(log[0]!.id).not.toBe(log[1]!.id);
    // UUID format check
    expect(log[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('handles entries with optional details field', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'system',
      action: 'auth:login',
      resource: 'user:admin',
      outcome: 'success',
      details: { ip: '127.0.0.1', browser: 'Chrome' },
    });

    const log = getLog();
    expect(log[0]!.details).toEqual({ ip: '127.0.0.1', browser: 'Chrome' });

    // Chain should still verify
    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Integration: Kernel + Audit Log
// ─────────────────────────────────────────────────────────────

describe('Integration — Kernel operations produce valid audit chain', () => {
  let store: ReturnType<typeof createKernelStore>;
  let kernel: KernelStore;

  beforeEach(() => {
    clearLog();
    store = createKernelStore();
    kernel = store.getState();
  });

  it('sequence of kernel operations produces a valid hash chain', async () => {
    // Register apps
    kernel.registerApp(fileExplorerManifest);
    kernel.registerApp(calculatorManifest);
    kernel = store.getState();

    // Launch processes
    kernel.launchProcess('file-explorer', 'win-1');
    kernel = store.getState();
    kernel.launchProcess('calculator', 'win-2');
    kernel = store.getState();

    // Capability checks (mix of grant and deny)
    kernel.requestCapability('file-explorer', 'fs:read');   // granted
    kernel.requestCapability('file-explorer', 'network');    // denied
    kernel.requestCapability('calculator', 'fs:read');       // denied

    // Terminate a process
    kernel.terminateProcess(1);

    // Wait for all fire-and-forget audit writes to drain
    await flushLog();

    // The audit log should have entries and the chain should be valid
    const log = getLog();
    expect(log.length).toBeGreaterThanOrEqual(5);

    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });
});
