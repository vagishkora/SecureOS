import { openDB, IDBPDatabase } from 'idb';
import { AuditEntry, Process } from './types';

interface SecureOSDB {
  audit_log: {
    key: string;
    value: AuditEntry;
  };
  kernel_state: {
    key: string;
    value: any;
  };
  settings_state: {
    key: string;
    value: any;
  };
  users: {
    key: string; // username (primary key)
    value: any;  // UserRecord — typed in userdb.ts to avoid circular deps
  };
}

let dbPromise: Promise<IDBPDatabase<SecureOSDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SecureOSDB>('secureos-system', 2, {
      upgrade(db, oldVersion) {
        // v1: core stores
        if (oldVersion < 1) {
          db.createObjectStore('audit_log', { keyPath: 'id' });
          db.createObjectStore('kernel_state');
          db.createObjectStore('settings_state');
        }
        // v2: per-user account store
        if (oldVersion < 2) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAuditEntry(entry: AuditEntry) {
  const db = await getDB();
  await db.put('audit_log', entry);
}

export async function loadAuditLog(): Promise<AuditEntry[]> {
  const db = await getDB();
  // idb getAll returns elements in key order, wait, we want insertion order
  // Our IDs are UUIDs. But wait, we hash-chain them! We should probably store a sequential index,
  // or we can sort them after loading since previousHash points to the predecessor.
  // Actually, idb's object stores preserve insertion order? No, keyPath order.
  // Let's load all and reconstruct the chain.
  const entries = await db.getAll('audit_log');
  
  if (entries.length === 0) return [];

  // Sort them based on the hash chain
  const sorted: AuditEntry[] = [];
  const entryMap = new Map<string, AuditEntry>();
  let genesisEntry: AuditEntry | null = null;

  for (const e of entries) {
    entryMap.set(e.previousHash, e);
    if (e.previousHash === '0'.repeat(64)) {
      genesisEntry = e;
    }
  }

  let current = genesisEntry;
  while (current) {
    sorted.push(current);
    current = entryMap.get(current.hash) || null;
  }

  return sorted;
}

export async function clearAuditLogDB() {
  const db = await getDB();
  await db.clear('audit_log');
}

export async function saveKernelState(state: { processes: Process[], focusStack: string[], installedApps: string[] }) {
  const db = await getDB();
  await db.put('kernel_state', state, 'current_state');
}

export async function loadKernelState(): Promise<{ processes: Process[], focusStack: string[], installedApps: string[] } | undefined> {
  const db = await getDB();
  return await db.get('kernel_state', 'current_state');
}

export async function clearKernelStateDB() {
  const db = await getDB();
  await db.delete('kernel_state', 'current_state');
}

export const idbSettingsStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await getDB();
    const val = await db.get('settings_state', name);
    return val !== undefined ? val : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await getDB();
    await db.put('settings_state', value, name);
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await getDB();
    await db.delete('settings_state', name);
  },
};
