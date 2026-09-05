// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — Type Definitions
// ─────────────────────────────────────────────────────────────
// FSNode is the fundamental unit of the VFS tree. Every file and
// directory is an FSNode stored in IndexedDB. Two layers of
// access control protect every node:
//   1. Kernel capability (does the app's manifest allow fs:read/write?)
//   2. Unix permission bits (does this node allow the operation?)
// ─────────────────────────────────────────────────────────────

/**
 * Unix-style permission bits for a single scope (owner/group/other).
 *
 * In Phase 1 (single-user), only `owner` bits are checked.
 * `group` and `other` exist for future multi-user support
 * and for the terminal's `chmod` / `scan` commands.
 */
export interface PermissionBits {
  read: boolean;
  write: boolean;
  execute: boolean;
}

/**
 * Full Unix-style permission set — owner, group, other.
 *
 * Example mappings:
 *   chmod 755 → owner:rwx, group:r-x, other:r-x
 *   chmod 644 → owner:rw-, group:r--, other:r--
 *   chmod 600 → owner:rw-, group:---, other:---
 */
export interface FSPermissions {
  owner: PermissionBits;
  group: PermissionBits;
  other: PermissionBits;
}

/**
 * A node in the virtual file system tree.
 *
 * Stored in IndexedDB's `nodes` object store, keyed by `id`.
 * The tree structure is formed via `parentId` references.
 */
export interface FSNode {
  /** Unique node ID (crypto.randomUUID(), except root which is 'root') */
  id: string;
  /** Parent node's ID (null only for the root node) */
  parentId: string | null;
  /** Name of this node (e.g. "secret.txt", "docs") */
  name: string;
  /** Whether this is a file or directory */
  type: 'file' | 'directory';

  // ── Content (files only) ──
  /** Text content for files, empty string for directories */
  content: string;

  // ── Security ──
  /** Unix-style permission bits */
  permissions: FSPermissions;
  /**
   * SHA-256 hash of `content`, computed on every write.
   * Verified on every read to detect tampering.
   * For encrypted files, this covers the ciphertext (not plaintext).
   */
  integrityHash: string;

  // ── Encryption (vault paths only) ──
  /** True if content is AES-GCM encrypted (base64-encoded ciphertext) */
  encrypted: boolean;
  /** Hex-encoded AES-GCM initialization vector (12 bytes) */
  encryptionIV?: string;
  /** Hex-encoded PBKDF2 salt (16 bytes) */
  encryptionSalt?: string;

  // ── Metadata ──
  /** Epoch timestamp of creation */
  createdAt: number;
  /** When the file was last modified (epoch ms) */
  updatedAt: number;
  /** AppId that created the file */
  owner: string;
  /** Original path before moving to Recycle Bin (optional) */
  originalPath?: string;
}

/**
 * Result of a `readFile` operation.
 *
 * Includes the file content AND an integrity flag so the
 * caller (e.g., File Explorer UI) can warn about tampered files
 * without blocking access entirely.
 */
export interface ReadResult {
  /** The file content (may be ciphertext if file is encrypted) */
  content: string;
  /** True if SHA-256(content) matches the stored integrity hash */
  integrityValid: boolean;
  /** The full node metadata */
  node: FSNode;
}

// ─────────────────────────────────────────────────────────────
// Default Permissions
// ─────────────────────────────────────────────────────────────

/** Default file permissions: owner rw-, group r--, other r-- (chmod 644) */
export const DEFAULT_FILE_PERMISSIONS: FSPermissions = {
  owner: { read: true, write: true, execute: false },
  group: { read: true, write: false, execute: false },
  other: { read: true, write: false, execute: false },
};

/** Default directory permissions: owner rwx, group r-x, other r-x (chmod 755) */
export const DEFAULT_DIR_PERMISSIONS: FSPermissions = {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: false, execute: true },
  other: { read: true, write: false, execute: true },
};

/** Restricted permissions for vault: owner rw-, group ---, other --- (chmod 600) */
export const VAULT_FILE_PERMISSIONS: FSPermissions = {
  owner: { read: true, write: true, execute: false },
  group: { read: false, write: false, execute: false },
  other: { read: false, write: false, execute: false },
};
