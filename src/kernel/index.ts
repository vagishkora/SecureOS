// ─────────────────────────────────────────────────────────────
// SecureOS Kernel — Barrel Export
// ─────────────────────────────────────────────────────────────

// Types
export type {
  Capability,
  AppManifest,
  Process,
  AuditAction,
  AuditEntry,
  AuditEntryInput,
  ChainVerificationResult,
} from './types';

// Crypto utilities
export { sha256, canonicalize } from './crypto';

// Audit log
export {
  appendLog,
  flushLog,
  verifyChain,
  getLog,
  getLogLength,
  clearLog,
  _getInternalLogForTesting,
} from './audit';

// Kernel store
export {
  createKernelStore,
  kernelStore,
} from './store';
export type { KernelState, KernelActions, KernelStore } from './store';

// User database
export type { UserRecord } from './userdb';
export {
  hasAnyUser,
  listUsers,
  getUser,
  createUser,
  verifyUserPassword,
  deleteUser,
  getLockoutRemainingMinutes,
  changePassword,
  updateProfile,
} from './userdb';
