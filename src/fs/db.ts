// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — IndexedDB Schema
// ─────────────────────────────────────────────────────────────
// Uses `idb` for a Promise-based, type-safe IndexedDB wrapper.
// The file system is a relational tree: nodes reference their
// parent's ID.
// ─────────────────────────────────────────────────────────────

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { FSNode } from './types';
import { DEFAULT_DIR_PERMISSIONS } from './types';

export interface SecureOSDB extends DBSchema {
  nodes: {
    key: string;          // FSNode.id
    value: FSNode;
    indexes: {
      'by-parent': string; // Index on parentId
    };
  };
}

export const DB_NAME = 'secureos-vfs';
export const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SecureOSDB> | null = null;

/**
 * Open the database (or return the cached connection), creating it
 * and the root/vault nodes if this is the first run.
 */
export async function getDB(): Promise<IDBPDatabase<SecureOSDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SecureOSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('nodes')) {
        const store = db.createObjectStore('nodes', { keyPath: 'id' });
        
        // Index for querying children of a directory
        store.createIndex('by-parent', 'parentId');

        const now = Date.now();
        
        // 1. Genesis Root Node (/)
        const rootNode: FSNode = {
          id: 'root',
          parentId: null, // The only node with null parent
          name: '',       // The root itself has no name component in path resolution
          type: 'directory',
          content: '',
          permissions: DEFAULT_DIR_PERMISSIONS,
          integrityHash: '',
          encrypted: false,
          createdAt: now,
          updatedAt: now,
          owner: 'system',
        };
        store.add(rootNode);

        // 2. Default /vault directory (pre-created for ease of use)
        const vaultNode: FSNode = {
          id: crypto.randomUUID(),
          parentId: 'root',
          name: 'vault',
          type: 'directory',
          content: '',
          permissions: DEFAULT_DIR_PERMISSIONS,
          integrityHash: '',
          encrypted: false,
          createdAt: now,
          updatedAt: now,
          owner: 'system',
        };
        store.add(vaultNode);

        // 3. RecycleBin directory
        const recycleBinNode: FSNode = {
          id: crypto.randomUUID(),
          parentId: 'root',
          name: 'RecycleBin',
          type: 'directory',
          content: '',
          permissions: DEFAULT_DIR_PERMISSIONS,
          integrityHash: '',
          encrypted: false,
          createdAt: now,
          updatedAt: now,
          owner: 'system',
        };
        store.add(recycleBinNode);
      }
    },
  });

  return dbInstance;
}

/**
 * Close the cached database connection. 
 * FOR TESTING ONLY (allows cleanly deleting the database).
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function initFS() {
  const db = await getDB();
  // Ensure RecycleBin exists for legacy databases that upgraded before this code
  const children = await db.getAllFromIndex('nodes', 'by-parent', 'root');
  if (!children.find(c => c.name === 'RecycleBin')) {
    const now = Date.now();
    await db.put('nodes', {
      id: crypto.randomUUID(),
      parentId: 'root',
      name: 'RecycleBin',
      type: 'directory',
      content: '',
      permissions: DEFAULT_DIR_PERMISSIONS,
      integrityHash: '',
      encrypted: false,
      createdAt: now,
      updatedAt: now,
      owner: 'system',
    });
  }
}
