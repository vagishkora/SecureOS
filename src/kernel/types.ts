// ─────────────────────────────────────────────────────────────
// SecureOS Kernel — Type Definitions
// ─────────────────────────────────────────────────────────────
// Every module in the system imports types from here.
// Capabilities are a CLOSED set — adding a new one is a
// compile-time breaking change that forces exhaustive handling.
// ─────────────────────────────────────────────────────────────

/**
 * The complete set of capabilities the system recognizes.
 *
 * This is intentionally a closed union rather than `string` so that
 * TypeScript's exhaustiveness checking catches unhandled capabilities
 * at compile time — critical for a security primitive.
 */
export type Capability =
  | 'fs:read'
  | 'fs:write'
  | 'fs:execute'
  | 'network'
  | 'clipboard'
  | 'assistant:query'
  | 'assistant:control'
  | 'system:audit'
  | 'system:process';

/**
 * An app's manifest — declared at registration time.
 *
 * The `capabilities` array is the app's permission budget.
 * `requestCapability()` will deny anything not listed here.
 */
export interface AppManifest {
  /** Unique identifier for the app (e.g. 'vault', 'terminal') */
  appId: string;
  /** Human-readable display name */
  name: string;
  /** Icon name (e.g., from Lucide) for the UI taskbar */
  icon?: string;
  /** Capabilities this app is allowed to request at runtime */
  capabilities: readonly Capability[];
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  snapState: 'none' | 'left' | 'right' | 'maximized';
}

/**
 * A running instance of a registered app.
 */
export interface Process {
  /** Unique process ID, monotonically increasing */
  pid: number;
  /** Which app this process is an instance of */
  appId: string;
  /** The window this process is rendered in */
  windowId: string;
  /** The virtual desktop this process is assigned to */
  desktopId: string;
  /** Current lifecycle state */
  status: 'running' | 'suspended' | 'terminated';
  /** Epoch timestamp when the process was launched */
  startedAt: number;
  /** The window position and size */
  windowState?: WindowState;
  /** Optional payload passed during launch (e.g. file path to open) */
  initialPayload?: any;
}

export interface AppNotification {
  id: string;
  appId: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Audit Log Types
// ─────────────────────────────────────────────────────────────

/**
 * All actions that can appear in the audit log.
 */
export type AuditAction =
  | 'process:launch'
  | 'process:terminate'
  | 'capability:request'
  | 'capability:grant'
  | 'capability:deny'
  | 'auth:login'
  | 'auth:logout'
  | 'auth:failed'
  | 'fs:read'
  | 'fs:write'
  | 'fs:delete'
  | 'fs:mkdir'
  | 'fs:chmod'
  | 'fs:integrity_check'
  | 'vault:encrypt'
  | 'vault:decrypt'
  | 'assistant:action';

/**
 * A single entry in the hash-chained audit log.
 *
 * Hash-chaining invariant:
 *   entry[0].previousHash = '0'.repeat(64)   (genesis anchor)
 *   entry[n].previousHash = entry[n-1].hash
 *   entry[n].hash = SHA-256(canonicalize(entry without hash field))
 */
export interface AuditEntry {
  /** Unique entry ID (crypto.randomUUID()) */
  id: string;
  /** Epoch timestamp */
  timestamp: number;
  /** Who performed the action (appId, 'system', or 'user') */
  actor: string;
  /** What happened */
  action: AuditAction;
  /** What was acted upon (resource path, capability name, etc.) */
  resource: string;
  /** Result of the action */
  outcome: 'granted' | 'denied' | 'success' | 'failure';
  /** Optional structured metadata */
  details?: Record<string, unknown>;
  /** SHA-256 hash of the previous entry (genesis = 64 zeros) */
  previousHash: string;
  /** SHA-256 hash of this entry (computed over all fields except `hash`) */
  hash: string;
}

/**
 * Input to `appendLog()` — the caller provides these fields,
 * and the audit system fills in `id`, `previousHash`, and `hash`.
 */
export type AuditEntryInput = Omit<AuditEntry, 'id' | 'previousHash' | 'hash'>;

/**
 * Result of `verifyChain()`.
 */
export interface ChainVerificationResult {
  /** True if the entire chain is intact */
  valid: boolean;
  /** Index of the first broken link (undefined if valid) */
  brokenAt?: number;
  /** Human-readable reason for the break */
  reason?: string;
}
