// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — Unit & Integration Tests
// ─────────────────────────────────────────────────────────────
// We use fake-indexeddb to mock the browser's IndexedDB in Node.
// ─────────────────────────────────────────────────────────────

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { kernelStore, flushLog, clearLog, _getInternalLogForTesting, getLog } from '../../kernel';
import { getDB, closeDB, DB_NAME } from '../db';
import {
  readFile,
  writeFile,
  encryptedRead,
  encryptedWrite,
  mkdir,
  ls,
  rm,
  stat,
  chmod,
  verifyIntegrity,
} from '../operations';
import { FSError } from '../errors';
import { DEFAULT_DIR_PERMISSIONS } from '../types';

describe('Virtual File System', () => {
  beforeEach(async () => {
    // 1. Reset Kernel state & Audit Log
    kernelStore.getState()._reset();
    clearLog();

    // 2. Clear IndexedDB for test isolation
    await closeDB();
    const req = indexedDB.deleteDatabase(DB_NAME);
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('deleteDatabase blocked'));
    });

    // 3. Register test apps
    kernelStore.getState().registerApp({
      appId: 'explorer',
      name: 'File Explorer',
      capabilities: ['fs:read', 'fs:write'],
    });
    kernelStore.getState().registerApp({
      appId: 'reader',
      name: 'Reader App',
      capabilities: ['fs:read'],
    });
    kernelStore.getState().registerApp({
      appId: 'untrusted',
      name: 'Untrusted App',
      capabilities: [],
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Permission Denial Tests (Layer 1: Kernel & Layer 2: Unix)
  // ─────────────────────────────────────────────────────────────
  describe('Permission Enforcement', () => {
    it('readFile denied when app lacks fs:read capability', async () => {
      await expect(readFile('untrusted', '/')).rejects.toThrow(
        /Kernel capability fs:read denied/
      );
    });

    it('writeFile denied when app lacks fs:write capability', async () => {
      await expect(writeFile('reader', '/test.txt', 'hello')).rejects.toThrow(
        /Kernel capability fs:write denied/
      );
    });

    it('readFile denied when Unix perms disallow read', async () => {
      await writeFile('explorer', '/secret.txt', 'hello', {
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: false, execute: false },
        other: { read: false, write: false, execute: false },
      });

      await expect(readFile('explorer', '/secret.txt')).rejects.toThrow(
        /Unix permission denied: missing read/
      );
    });

    it('writeFile denied when Unix perms disallow write', async () => {
      await writeFile('explorer', '/readonly.txt', 'hello', {
        owner: { read: true, write: false, execute: false },
        group: { read: false, write: false, execute: false },
        other: { read: false, write: false, execute: false },
      });

      await expect(writeFile('explorer', '/readonly.txt', 'new')).rejects.toThrow(
        /Unix permission denied: missing write/
      );
    });

    it('denied operations are audited', async () => {
      await expect(readFile('untrusted', '/test.txt')).rejects.toThrow();
      await flushLog();

      const log = getLog();
      // Expect capability denial
      expect(log.some((entry) => entry.action === 'capability:deny')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Integrity Hash Tests
  // ─────────────────────────────────────────────────────────────
  describe('Integrity Verification', () => {
    it('writeFile computes SHA-256 integrity hash', async () => {
      const node = await writeFile('explorer', '/test.txt', 'hello');
      // sha256 of 'hello'
      expect(node.integrityHash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('readFile detects integrity hash mismatch', async () => {
      const node = await writeFile('explorer', '/test.txt', 'hello');

      // Simulate a malicious overwrite bypassing the VFS (e.g. directly to DB)
      const db = await getDB();
      node.content = 'tampered';
      await db.put('nodes', node);

      // Now read it via VFS
      const result = await readFile('explorer', '/test.txt');
      expect(result.integrityValid).toBe(false);

      await flushLog();
      const log = getLog();
      expect(
        log.some(
          (e) =>
            e.action === 'fs:integrity_check' &&
            e.outcome === 'failure' &&
            e.details?.reason === 'integrity_mismatch'
        )
      ).toBe(true);
    });

    it('verifyIntegrity returns true for untampered file', async () => {
      await writeFile('explorer', '/test.txt', 'hello');
      const isValid = await verifyIntegrity('explorer', '/test.txt');
      expect(isValid).toBe(true);
    });

    it('verifyIntegrity returns false for tampered file', async () => {
      const node = await writeFile('explorer', '/test.txt', 'hello');
      const db = await getDB();
      node.content = 'tampered';
      await db.put('nodes', node);

      const isValid = await verifyIntegrity('explorer', '/test.txt');
      expect(isValid).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Vault Encryption Tests
  // ─────────────────────────────────────────────────────────────
  describe('Vault Encryption', () => {
    it('encryptedWrite + encryptedRead round-trip', async () => {
      await encryptedWrite('explorer', '/vault/secret.txt', 'my deep dark secret', 'password123');

      const result = await encryptedRead('explorer', '/vault/secret.txt', 'password123');
      expect(result.content).toBe('my deep dark secret');
      expect(result.integrityValid).toBe(true);
    });

    it('encryptedRead with wrong password fails', async () => {
      await encryptedWrite('explorer', '/vault/secret.txt', 'my deep dark secret', 'password123');

      await expect(
        encryptedRead('explorer', '/vault/secret.txt', 'wrongpassword')
      ).rejects.toThrow('Decryption failed');
    });

    it('encrypted file has integrity hash over ciphertext', async () => {
      const node = await encryptedWrite('explorer', '/vault/secret.txt', 'hello', 'password123');
      
      // Node content is ciphertext base64
      expect(node.content).not.toContain('hello');
      expect(node.encrypted).toBe(true);

      // verifyIntegrity hashes the ciphertext, not plaintext. 
      // It should pass without needing the password!
      const isValid = await verifyIntegrity('explorer', '/vault/secret.txt');
      expect(isValid).toBe(true);
    });

    it('encryptedRead on non-vault path throws', async () => {
      await expect(
        encryptedRead('explorer', '/normal.txt', 'password')
      ).rejects.toThrow('encryptedRead only works on /vault/ paths');
    });

    it('readFile on encrypted path throws', async () => {
      await encryptedWrite('explorer', '/vault/secret.txt', 'hello', 'password');
      await expect(readFile('explorer', '/vault/secret.txt')).rejects.toThrow(
        /Cannot use readFile on an encrypted file/
      );
    });

    it('writeFile on vault path throws', async () => {
      await expect(writeFile('explorer', '/vault/secret.txt', 'hello')).rejects.toThrow(
        /Cannot use writeFile on \/vault\/ paths/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // General FS Operations Tests
  // ─────────────────────────────────────────────────────────────
  describe('General Operations', () => {
    it('mkdir creates a directory node and ls lists it', async () => {
      await mkdir('explorer', '/docs');
      const children = await ls('explorer', '/');
      
      expect(children.length).toBe(2); // docs + vault (pre-created)
      expect(children.find(c => c.name === 'docs')?.type).toBe('directory');
    });

    it('rm removes a file', async () => {
      await writeFile('explorer', '/test.txt', 'hello');
      await rm('explorer', '/test.txt');

      const children = await ls('explorer', '/');
      expect(children.find(c => c.name === 'test.txt')).toBeUndefined();
    });

    it('rm recursively removes a directory', async () => {
      await mkdir('explorer', '/docs');
      await writeFile('explorer', '/docs/file1.txt', 'hello');
      await writeFile('explorer', '/docs/file2.txt', 'world');
      
      await rm('explorer', '/docs');

      const db = await getDB();
      const allNodes = await db.getAll('nodes');
      // Root + Vault
      expect(allNodes.length).toBe(2);
    });

    it('writeFile to existing path updates content + hash', async () => {
      const node1 = await writeFile('explorer', '/test.txt', 'v1');
      const node2 = await writeFile('explorer', '/test.txt', 'v2');

      expect(node1.id).toBe(node2.id); // Same node
      expect(node1.integrityHash).not.toBe(node2.integrityHash);
      
      const result = await readFile('explorer', '/test.txt');
      expect(result.content).toBe('v2');
    });

    it('path resolution works for nested paths', async () => {
      await mkdir('explorer', '/a');
      await mkdir('explorer', '/a/b');
      await mkdir('explorer', '/a/b/c');
      const node = await writeFile('explorer', '/a/b/c/d.txt', 'deep');

      const result = await readFile('explorer', '/a/b/c/d.txt');
      expect(result.content).toBe('deep');
      expect(result.node.id).toBe(node.id);
    });

    it('read/write to nonexistent path throws NOT_FOUND', async () => {
      await expect(readFile('explorer', '/missing.txt')).rejects.toThrow(/NOT_FOUND/);
      await expect(writeFile('explorer', '/missing/file.txt', 'hello')).rejects.toThrow(/NOT_FOUND/);
    });

    it('all FS operations produce audit entries', async () => {
      await writeFile('explorer', '/test.txt', 'hello');
      await readFile('explorer', '/test.txt');
      await chmod('explorer', '/test.txt', DEFAULT_DIR_PERMISSIONS);
      await mkdir('explorer', '/dir');
      await stat('explorer', '/dir');
      await rm('explorer', '/test.txt');

      await flushLog();
      const log = getLog();
      
      const actions = log.map(e => e.action);
      expect(actions).toContain('fs:write');
      expect(actions).toContain('fs:read');
      expect(actions).toContain('fs:chmod');
      expect(actions).toContain('fs:mkdir');
      expect(actions).toContain('fs:delete');
    });
  });
});
