// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — Error Types
// ─────────────────────────────────────────────────────────────
// Every FS error carries a machine-readable `code` and the
// `path` that triggered it. This makes programmatic error
// handling trivial: `if (err.code === 'PERMISSION_DENIED')`.
// ─────────────────────────────────────────────────────────────

/**
 * All error codes the VFS can produce.
 */
export type FSErrorCode =
  | 'PERMISSION_DENIED'     // Kernel capability or Unix perms failed
  | 'NOT_FOUND'             // Path doesn't exist in the tree
  | 'ALREADY_EXISTS'        // mkdir/writeFile collision (same name in same dir)
  | 'NOT_A_DIRECTORY'       // Tried to ls/mkdir inside a file
  | 'NOT_A_FILE'            // Tried to readFile on a directory
  | 'INTEGRITY_MISMATCH'    // SHA-256 of content ≠ stored hash
  | 'DECRYPTION_FAILED'     // Wrong vault password or corrupted ciphertext
  | 'NOT_ENCRYPTED'         // encryptedRead on an unencrypted file
  | 'INVALID_PATH';         // Malformed path (doesn't start with /, empty, etc.)

/**
 * A structured error from the virtual file system.
 *
 * @example
 * try {
 *   await vfs.readFile('calculator', '/secret.txt');
 * } catch (err) {
 *   if (err instanceof FSError && err.code === 'PERMISSION_DENIED') {
 *     console.log(`Access denied to ${err.path}`);
 *   }
 * }
 */
export class FSError extends Error {
  public readonly name = 'FSError';

  constructor(
    /** Machine-readable error code */
    public readonly code: FSErrorCode,
    /** The path that triggered the error */
    public readonly path: string,
    /** Human-readable description (defaults to `code: path`) */
    message?: string,
  ) {
    super(message ?? `${code}: ${path}`);
  }
}
