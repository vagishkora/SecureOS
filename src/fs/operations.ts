// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — Operations API
// ─────────────────────────────────────────────────────────────
// The core VFS API. Every operation enforces two layers of
// security before proceeding:
//   1. Kernel Capability (e.g. 'fs:read')
//   2. Unix Permission Bits (e.g. owner: { read: true })
// Every operation produces an immutable audit log entry.
// ─────────────────────────────────────────────────────────────

import { getDB } from './db';
import type { FSNode, FSPermissions, ReadResult } from './types';
import { DEFAULT_FILE_PERMISSIONS, DEFAULT_DIR_PERMISSIONS, VAULT_FILE_PERMISSIONS } from './types';
import { FSError } from './errors';
import { kernelStore, sha256, appendLog } from '../kernel';
import { encryptContent, decryptContent } from './vault';

// ─────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────

/**
 * 1st Layer of Security: Kernel Capabilities.
 * Checks the app's manifest via the kernel store.
 * The kernel automatically audits this check (granted or denied).
 */
function enforceCapability(appId: string, capability: 'fs:read' | 'fs:write', path: string) {
  const granted = kernelStore.getState().requestCapability(appId, capability);
  if (!granted) {
    throw new FSError('PERMISSION_DENIED', path, `Kernel capability ${capability} denied for ${appId}`);
  }
}

/**
 * 2nd Layer of Security: Unix Permission Bits.
 * Checks the specific FSNode's bits against the requested operation.
 */
function enforceUnixPermission(node: FSNode, appId: string, required: 'read' | 'write' | 'execute', path: string) {
  // In Phase 1, we assume the requesting app acts as the 'owner' for local files.
  // In a future multi-user scenario, we'd check `owner === userId` to decide
  // whether to use owner, group, or other bits.
  if (!node.permissions.owner[required]) {
    throw new FSError('PERMISSION_DENIED', path, `Unix permission denied: missing ${required} on ${path}`);
  }
}

/**
 * Split an absolute path into an array of segment names.
 */
function parsePath(path: string): string[] {
  if (!path.startsWith('/')) {
    throw new FSError('INVALID_PATH', path, 'Path must be absolute (start with /)');
  }
  return path.split('/').filter((s) => s.length > 0);
}

/**
 * Traverse the VFS tree from root to find the node at the given path.
 */
export async function resolvePath(path: string): Promise<FSNode> {
  const db = await getDB();
  const segments = parsePath(path);
  
  let current: FSNode | undefined = await db.get('nodes', 'root');
  if (!current) throw new FSError('NOT_FOUND', '/', 'System root directory missing');
  
  if (segments.length === 0) return current;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (current.type !== 'directory') {
      const partialPath = '/' + segments.slice(0, i).join('/');
      throw new FSError('NOT_A_DIRECTORY', partialPath, `Cannot traverse through file ${partialPath}`);
    }
    
    // Find child by parentId and name
    const children = await db.getAllFromIndex('nodes', 'by-parent', current.id);
    current = children.find((c) => c.name === segment);
    
    if (!current) {
      const failedPath = '/' + segments.slice(0, i + 1).join('/');
      throw new FSError('NOT_FOUND', failedPath);
    }
  }
  return current;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Read a standard file. Recomputes integrity hash automatically.
 */
export async function readFile(appId: string, path: string): Promise<ReadResult> {
  // 1st Layer: Capability check
  enforceCapability(appId, 'fs:read', path);
  
  if (window.secureOS) {
    try {
      const content = await window.secureOS.fs.readFile(appId, path);
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { electron: true } });
      return { content, integrityValid: true, node: {} as any };
    } catch (err: any) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { electron: true, reason: err.message } });
      throw new FSError('PERMISSION_DENIED', path, err.message);
    }
  }

  const node = await resolvePath(path);
  if (node.type !== 'file') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'NOT_A_FILE' } });
    throw new FSError('NOT_A_FILE', path);
  }
  
  if (node.encrypted) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'IS_ENCRYPTED' } });
    throw new FSError('PERMISSION_DENIED', path, 'Cannot use readFile on an encrypted file. Use encryptedRead instead.');
  }

  try {
    enforceUnixPermission(node, appId, 'read', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  // Check integrity
  const currentHash = await sha256(node.content);
  const integrityValid = currentHash === node.integrityHash;

  if (!integrityValid) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:integrity_check', resource: path, outcome: 'failure', details: { reason: 'integrity_mismatch' } });
  }

  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { integrityValid } });
  
  return {
    content: node.content,
    integrityValid,
    node,
  };
}

/**
 * Write to a standard file. Computes SHA-256 integrity hash automatically.
 */
export async function writeFile(
  appId: string, 
  path: string, 
  content: string, 
  permissions?: FSPermissions
): Promise<FSNode> {
  enforceCapability(appId, 'fs:write', path);

  if (window.secureOS) {
    try {
      await window.secureOS.fs.writeFile(appId, path, content);
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'success', details: { electron: true } });
      return {} as FSNode;
    } catch (err: any) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { electron: true, reason: err.message } });
      throw new FSError('PERMISSION_DENIED', path, err.message);
    }
  }

  if (path.startsWith('/vault/')) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'VAULT_PATH' } });
    throw new FSError('PERMISSION_DENIED', path, 'Cannot use writeFile on /vault/ paths. Use encryptedWrite instead.');
  }

  const db = await getDB();
  const segments = parsePath(path);
  const parentPath = '/' + segments.slice(0, -1).join('/');
  const fileName = segments[segments.length - 1];

  if (!fileName) throw new FSError('INVALID_PATH', path, 'Cannot write to root');

  const parentNode = await resolvePath(parentPath);
  if (parentNode.type !== 'directory') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'NOT_A_DIRECTORY' } });
    throw new FSError('NOT_A_DIRECTORY', parentPath);
  }

  try {
    enforceUnixPermission(parentNode, appId, 'write', parentPath);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'denied', details: { reason: 'parent_unix_permission' } });
    throw err;
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', parentNode.id);
  const existingNode = children.find((c) => c.name === fileName);

  if (existingNode) {
    if (existingNode.type !== 'file') {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'ALREADY_EXISTS_AS_DIR' } });
      throw new FSError('ALREADY_EXISTS', path, 'A directory already exists with this name');
    }
    if (existingNode.encrypted) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'IS_ENCRYPTED' } });
      throw new FSError('PERMISSION_DENIED', path, 'File is encrypted. Cannot overwrite with standard writeFile.');
    }
    try {
      enforceUnixPermission(existingNode, appId, 'write', path);
    } catch (err) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'denied', details: { reason: 'file_unix_permission' } });
      throw err;
    }
  }

  const integrityHash = await sha256(content);
  const now = Date.now();

  const node: FSNode = {
    id: existingNode ? existingNode.id : crypto.randomUUID(),
    parentId: parentNode.id,
    name: fileName,
    type: 'file',
    content,
    permissions: permissions ?? (existingNode?.permissions ?? DEFAULT_FILE_PERMISSIONS),
    integrityHash,
    encrypted: false,
    createdAt: existingNode ? existingNode.createdAt : now,
    updatedAt: now,
    owner: existingNode ? existingNode.owner : appId,
  };

  await db.put('nodes', node);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'success' });

  return node;
}

/**
 * Decrypt and read a vault file.
 */
export async function encryptedRead(appId: string, path: string, password: string): Promise<ReadResult> {
  enforceCapability(appId, 'fs:read', path);
  
  if (!path.startsWith('/vault/')) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'NOT_VAULT_PATH' } });
    throw new FSError('PERMISSION_DENIED', path, 'encryptedRead only works on /vault/ paths');
  }

  const node = await resolvePath(path);
  if (node.type !== 'file') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'NOT_A_FILE' } });
    throw new FSError('NOT_A_FILE', path);
  }
  
  if (!node.encrypted || !node.encryptionSalt || !node.encryptionIV) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'NOT_ENCRYPTED' } });
    throw new FSError('NOT_ENCRYPTED', path, 'File is not encrypted');
  }

  try {
    enforceUnixPermission(node, appId, 'read', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  const currentHash = await sha256(node.content); // Hash covers ciphertext
  const integrityValid = currentHash === node.integrityHash;

  if (!integrityValid) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:integrity_check', resource: path, outcome: 'failure', details: { reason: 'integrity_mismatch' } });
  }

  let plaintext: string;
  try {
    plaintext = await decryptContent(node.content, password, node.encryptionSalt, node.encryptionIV);
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'vault:decrypt', resource: path, outcome: 'success' });
  } catch (e) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'vault:decrypt', resource: path, outcome: 'failure', details: { reason: 'wrong_password_or_tampered' } });
    throw new FSError('DECRYPTION_FAILED', path, 'Decryption failed (wrong password or tampered ciphertext)');
  }

  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { integrityValid, encrypted: true } });
  
  return {
    content: plaintext,
    integrityValid,
    node,
  };
}

/**
 * Encrypt and write to a vault file.
 */
export async function encryptedWrite(
  appId: string, 
  path: string, 
  plaintext: string, 
  password: string,
  permissions?: FSPermissions
): Promise<FSNode> {
  enforceCapability(appId, 'fs:write', path);

  if (!path.startsWith('/vault/')) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'NOT_VAULT_PATH' } });
    throw new FSError('PERMISSION_DENIED', path, 'encryptedWrite only works on /vault/ paths');
  }

  const db = await getDB();
  const segments = parsePath(path);
  const parentPath = '/' + segments.slice(0, -1).join('/');
  const fileName = segments[segments.length - 1];

  if (!fileName) throw new FSError('INVALID_PATH', path);

  const parentNode = await resolvePath(parentPath);
  if (parentNode.type !== 'directory') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'NOT_A_DIRECTORY' } });
    throw new FSError('NOT_A_DIRECTORY', parentPath);
  }

  try {
    enforceUnixPermission(parentNode, appId, 'write', parentPath);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'denied', details: { reason: 'parent_unix_permission' } });
    throw err;
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', parentNode.id);
  const existingNode = children.find((c) => c.name === fileName);

  if (existingNode) {
    if (existingNode.type !== 'file') {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'ALREADY_EXISTS_AS_DIR' } });
      throw new FSError('ALREADY_EXISTS', path, 'A directory already exists with this name');
    }
    if (!existingNode.encrypted) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'failure', details: { reason: 'NOT_ENCRYPTED' } });
      throw new FSError('PERMISSION_DENIED', path, 'File is not encrypted. Cannot overwrite with encryptedWrite.');
    }
    try {
      enforceUnixPermission(existingNode, appId, 'write', path);
    } catch (err) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'denied', details: { reason: 'file_unix_permission' } });
      throw err;
    }
  }

  const { ciphertextBase64, saltHex, ivHex } = await encryptContent(plaintext, password);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'vault:encrypt', resource: path, outcome: 'success' });

  // Integrity hash covers the CIPHERTEXT
  const integrityHash = await sha256(ciphertextBase64);
  const now = Date.now();

  const node: FSNode = {
    id: existingNode ? existingNode.id : crypto.randomUUID(),
    parentId: parentNode.id,
    name: fileName,
    type: 'file',
    content: ciphertextBase64,
    permissions: permissions ?? (existingNode?.permissions ?? VAULT_FILE_PERMISSIONS),
    integrityHash,
    encrypted: true,
    encryptionSalt: saltHex,
    encryptionIV: ivHex,
    createdAt: existingNode ? existingNode.createdAt : now,
    updatedAt: now,
    owner: existingNode ? existingNode.owner : appId,
  };

  await db.put('nodes', node);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: path, outcome: 'success' });

  return node;
}

/**
 * Create a new directory.
 */
export async function mkdir(appId: string, path: string, permissions?: FSPermissions): Promise<FSNode> {
  enforceCapability(appId, 'fs:write', path);

  if (window.secureOS) {
    try {
      await window.secureOS.fs.mkdir(appId, path);
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'success', details: { electron: true } });
      return {} as FSNode;
    } catch (err: any) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'failure', details: { electron: true, reason: err.message } });
      throw new FSError('PERMISSION_DENIED', path, err.message);
    }
  }

  const db = await getDB();
  const segments = parsePath(path);
  const parentPath = '/' + segments.slice(0, -1).join('/');
  const dirName = segments[segments.length - 1];

  if (!dirName) throw new FSError('INVALID_PATH', path, 'Cannot recreate root');

  const parentNode = await resolvePath(parentPath);
  if (parentNode.type !== 'directory') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'failure', details: { reason: 'NOT_A_DIRECTORY' } });
    throw new FSError('NOT_A_DIRECTORY', parentPath);
  }

  try {
    enforceUnixPermission(parentNode, appId, 'write', parentPath);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'denied', details: { reason: 'parent_unix_permission' } });
    throw err;
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', parentNode.id);
  if (children.find((c) => c.name === dirName)) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'failure', details: { reason: 'ALREADY_EXISTS' } });
    throw new FSError('ALREADY_EXISTS', path);
  }

  const now = Date.now();
  const isVault = path.startsWith('/vault/');

  const node: FSNode = {
    id: crypto.randomUUID(),
    parentId: parentNode.id,
    name: dirName,
    type: 'directory',
    content: '',
    permissions: permissions ?? (isVault ? VAULT_FILE_PERMISSIONS : DEFAULT_DIR_PERMISSIONS),
    integrityHash: '',
    encrypted: false,
    createdAt: now,
    updatedAt: now,
    owner: appId,
  };

  await db.put('nodes', node);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:mkdir', resource: path, outcome: 'success' });

  return node;
}

/**
 * List the contents of a directory.
 */
export async function ls(appId: string, path: string): Promise<FSNode[]> {
  enforceCapability(appId, 'fs:read', path);

  if (window.secureOS) {
    try {
      const files = await window.secureOS.fs.ls(appId, path);
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { operation: 'ls', electron: true } });
      return files as any[];
    } catch (err: any) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { electron: true, reason: err.message } });
      throw new FSError('PERMISSION_DENIED', path, err.message);
    }
  }

  const db = await getDB();
  const node = await resolvePath(path);

  if (node.type !== 'directory') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'failure', details: { reason: 'NOT_A_DIRECTORY' } });
    throw new FSError('NOT_A_DIRECTORY', path);
  }

  try {
    enforceUnixPermission(node, appId, 'read', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', node.id);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { operation: 'ls' } });
  
  return children;
}

/**
 * Get the metadata for a path without reading its content.
 */
export async function stat(appId: string, path: string): Promise<FSNode> {
  enforceCapability(appId, 'fs:read', path);

  const node = await resolvePath(path);

  try {
    enforceUnixPermission(node, appId, 'read', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: path, outcome: 'success', details: { operation: 'stat' } });
  return node;
}

/**
 * Remove a file or recursively remove a directory.
 */
export async function rm(appId: string, path: string): Promise<void> {
  enforceCapability(appId, 'fs:write', path);

  if (window.secureOS) {
    try {
      await window.secureOS.fs.rm(appId, path);
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:delete', resource: path, outcome: 'success', details: { electron: true } });
      return;
    } catch (err: any) {
      void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:delete', resource: path, outcome: 'failure', details: { electron: true, reason: err.message } });
      throw new FSError('PERMISSION_DENIED', path, err.message);
    }
  }

  if (path === '/' || path === '/vault') {
    throw new FSError('PERMISSION_DENIED', path, 'Cannot delete system roots');
  }

  const db = await getDB();
  const node = await resolvePath(path);

  const segments = parsePath(path);
  const parentPath = '/' + segments.slice(0, -1).join('/');
  const parentNode = await resolvePath(parentPath);

  try {
    enforceUnixPermission(parentNode, appId, 'write', parentPath);
    enforceUnixPermission(node, appId, 'write', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:delete', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  // Recursive delete
  async function deleteSubtree(nodeId: string) {
    const children = await db.getAllFromIndex('nodes', 'by-parent', nodeId);
    for (const child of children) {
      if (child.type === 'directory') {
        await deleteSubtree(child.id);
      }
      await db.delete('nodes', child.id);
    }
    await db.delete('nodes', nodeId);
  }

  await deleteSubtree(node.id);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:delete', resource: path, outcome: 'success' });
}

/**
 * Move or rename a node.
 */
export async function mv(appId: string, sourcePath: string, destPath: string, originalPath?: string): Promise<FSNode> {
  enforceCapability(appId, 'fs:write', sourcePath);
  enforceCapability(appId, 'fs:write', destPath);

  if (sourcePath === '/' || sourcePath === '/vault' || sourcePath === '/RecycleBin') {
    throw new FSError('PERMISSION_DENIED', sourcePath, 'Cannot move system roots');
  }

  const db = await getDB();
  const sourceNode = await resolvePath(sourcePath);

  const sourceSegments = parsePath(sourcePath);
  const sourceParentPath = '/' + sourceSegments.slice(0, -1).join('/');
  const sourceParentNode = await resolvePath(sourceParentPath);

  const destSegments = parsePath(destPath);
  const destParentPath = '/' + destSegments.slice(0, -1).join('/');
  const destName = destSegments[destSegments.length - 1];
  
  if (!destName) throw new FSError('INVALID_PATH', destPath, 'Cannot move to root');

  const destParentNode = await resolvePath(destParentPath);
  
  if (destParentNode.type !== 'directory') {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: destPath, outcome: 'failure', details: { operation: 'mv', reason: 'NOT_A_DIRECTORY' } });
    throw new FSError('NOT_A_DIRECTORY', destParentPath);
  }

  try {
    enforceUnixPermission(sourceParentNode, appId, 'write', sourceParentPath);
    enforceUnixPermission(sourceNode, appId, 'write', sourcePath);
    enforceUnixPermission(destParentNode, appId, 'write', destParentPath);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: sourcePath, outcome: 'denied', details: { operation: 'mv', reason: 'unix_permission' } });
    throw err;
  }

  // Ensure we are not moving a directory into itself
  if (sourceNode.type === 'directory' && destPath.startsWith(sourcePath + '/')) {
    throw new FSError('INVALID_PATH', destPath, 'Cannot move a directory into itself');
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', destParentNode.id);
  const existingNode = children.find((c) => c.name === destName);

  if (existingNode) {
    throw new FSError('ALREADY_EXISTS', destPath, 'Destination already exists');
  }

  // Check if moving between vault and non-vault
  const isSourceVault = sourcePath.startsWith('/vault/');
  const isDestVault = destPath.startsWith('/vault/');
  if (isSourceVault !== isDestVault) {
    throw new FSError('PERMISSION_DENIED', destPath, 'Cannot cross vault boundaries with mv. Use cp to encrypt/decrypt properly.');
  }

  sourceNode.parentId = destParentNode.id;
  sourceNode.name = destName;
  sourceNode.updatedAt = Date.now();
  if (originalPath) {
    sourceNode.originalPath = originalPath;
  } else if (sourceNode.originalPath && !destPath.startsWith('/RecycleBin')) {
    // Clear originalPath if moved OUT of Recycle Bin (e.g. restore)
    delete sourceNode.originalPath;
  }

  await db.put('nodes', sourceNode);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: `${sourcePath} -> ${destPath}`, outcome: 'success', details: { operation: 'mv' } });

  return sourceNode;
}

/**
 * Copy a node.
 */
export async function cp(appId: string, sourcePath: string, destPath: string): Promise<FSNode> {
  enforceCapability(appId, 'fs:read', sourcePath);
  enforceCapability(appId, 'fs:write', destPath);

  if (sourcePath === '/' || sourcePath === '/vault' || sourcePath === '/RecycleBin') {
    throw new FSError('PERMISSION_DENIED', sourcePath, 'Cannot copy system roots');
  }

  const isSourceVault = sourcePath.startsWith('/vault/');
  const isDestVault = destPath.startsWith('/vault/');
  if (isSourceVault !== isDestVault) {
    throw new FSError('PERMISSION_DENIED', destPath, 'Cannot cross vault boundaries with cp.');
  }

  const db = await getDB();
  const sourceNode = await resolvePath(sourcePath);

  const destSegments = parsePath(destPath);
  const destParentPath = '/' + destSegments.slice(0, -1).join('/');
  const destName = destSegments[destSegments.length - 1];

  if (!destName) throw new FSError('INVALID_PATH', destPath, 'Cannot copy to root');

  const destParentNode = await resolvePath(destParentPath);

  if (destParentNode.type !== 'directory') {
    throw new FSError('NOT_A_DIRECTORY', destParentPath);
  }

  try {
    enforceUnixPermission(sourceNode, appId, 'read', sourcePath);
    enforceUnixPermission(destParentNode, appId, 'write', destParentPath);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:read', resource: sourcePath, outcome: 'denied', details: { operation: 'cp', reason: 'unix_permission' } });
    throw err;
  }

  // Ensure we are not copying a directory into itself
  if (sourceNode.type === 'directory' && destPath.startsWith(sourcePath + '/')) {
    throw new FSError('INVALID_PATH', destPath, 'Cannot copy a directory into itself');
  }

  const children = await db.getAllFromIndex('nodes', 'by-parent', destParentNode.id);
  const existingNode = children.find((c) => c.name === destName);

  if (existingNode) {
    throw new FSError('ALREADY_EXISTS', destPath, 'Destination already exists');
  }

  async function cloneNode(node: FSNode, newParentId: string, newName: string): Promise<FSNode> {
    const newNode: FSNode = {
      ...node,
      id: crypto.randomUUID(),
      parentId: newParentId,
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      owner: appId,
    };
    
    // Remove RecycleBin specific metadata
    delete newNode.originalPath;

    await db.put('nodes', newNode);

    if (node.type === 'directory') {
      const childNodes = await db.getAllFromIndex('nodes', 'by-parent', node.id);
      for (const child of childNodes) {
        await cloneNode(child, newNode.id, child.name);
      }
    }
    return newNode;
  }

  const copiedNode = await cloneNode(sourceNode, destParentNode.id, destName);
  
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:write', resource: `${sourcePath} -> ${destPath}`, outcome: 'success', details: { operation: 'cp' } });

  return copiedNode;
}

/**
 * Update the permission bits of a node.
 */
export async function chmod(appId: string, path: string, permissions: FSPermissions): Promise<void> {
  enforceCapability(appId, 'fs:write', path);

  const db = await getDB();
  const node = await resolvePath(path);

  try {
    enforceUnixPermission(node, appId, 'write', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:chmod', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  node.permissions = permissions;
  node.updatedAt = Date.now();

  await db.put('nodes', node);
  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:chmod', resource: path, outcome: 'success' });
}

/**
 * Explicitly verify the integrity hash without reading the content (e.g. for Security Center scans).
 */
export async function verifyIntegrity(appId: string, path: string): Promise<boolean> {
  enforceCapability(appId, 'fs:read', path);
  const node = await resolvePath(path);

  if (node.type !== 'file') throw new FSError('NOT_A_FILE', path);

  try {
    enforceUnixPermission(node, appId, 'read', path);
  } catch (err) {
    void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:integrity_check', resource: path, outcome: 'denied', details: { reason: 'unix_permission' } });
    throw err;
  }

  const currentHash = await sha256(node.content);
  const integrityValid = currentHash === node.integrityHash;

  void appendLog({ timestamp: Date.now(), actor: appId, action: 'fs:integrity_check', resource: path, outcome: integrityValid ? 'success' : 'failure' });
  return integrityValid;
}
