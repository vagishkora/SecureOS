// ─────────────────────────────────────────────────────────────
// SecureOS — User Database
// ─────────────────────────────────────────────────────────────
// Local IndexedDB-backed multi-user account management.
// Every user gets a unique random salt so two users with the
// same password produce completely different hashes.
// ─────────────────────────────────────────────────────────────

import { getDB } from './idb';

// ─── Types ───────────────────────────────────────────────────

export interface UserRecord {
  /** Primary key — lowercase, alphanumeric + underscores, 2–20 chars */
  username: string;
  /** Human-readable display name shown on the login screen */
  displayName: string;
  /** Emoji avatar (e.g. "🧑‍💻") */
  avatar: string;
  /** 'admin' for the first account ever created, 'user' for all others */
  role: 'admin' | 'user';
  /** PBKDF2-SHA256 hex output */
  passwordHash: string;
  /** Random 16-byte per-user salt in hex */
  salt: string;
  createdAt: number;
  lastLoginAt: number | null;
  /** Consecutive failed login attempts (resets on success or lockout expiry) */
  failedAttempts: number;
  /** Epoch ms until which the account is locked, or null if not locked */
  lockedUntil: number | null;
}

// ─── Internal Constants ───────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ─── Internal Crypto ─────────────────────────────────────────

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Public API ──────────────────────────────────────────────

/** Returns true if at least one user account exists in the DB. */
export async function hasAnyUser(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('users');
  return count > 0;
}

/** List all user records. */
export async function listUsers(): Promise<UserRecord[]> {
  const db = await getDB();
  return (await db.getAll('users')) as UserRecord[];
}

/** Get a single user by username (case-insensitive). */
export async function getUser(username: string): Promise<UserRecord | undefined> {
  const db = await getDB();
  return (await db.get('users', username.toLowerCase())) as UserRecord | undefined;
}

/**
 * Create a new user account.
 * The very first account ever created is automatically given the 'admin' role.
 *
 * @throws if the username is invalid or already taken.
 */
export async function createUser(
  username: string,
  displayName: string,
  avatar: string,
  password: string
): Promise<UserRecord> {
  const db = await getDB();
  const normalized = username.toLowerCase().trim();

  if (!/^[a-z0-9_]{2,20}$/.test(normalized)) {
    throw new Error('Username must be 2–20 characters: lowercase letters, numbers, underscores only.');
  }
  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  const existing = await db.get('users', normalized);
  if (existing) throw new Error(`Username "${normalized}" is already taken.`);

  const isFirstUser = (await db.count('users')) === 0;
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const record: UserRecord = {
    username: normalized,
    displayName: displayName.trim() || normalized,
    avatar,
    role: isFirstUser ? 'admin' : 'user',
    passwordHash,
    salt,
    createdAt: Date.now(),
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
  };

  await db.put('users', record);
  return record;
}

/**
 * Verify a user password. Manages lockout state internally.
 * @returns
 *   'success'        — password correct, lastLoginAt updated
 *   'wrong_password' — incorrect, failedAttempts incremented
 *   'locked'         — account is currently locked out
 *   'not_found'      — no account with that username
 */
export async function verifyUserPassword(
  username: string,
  password: string
): Promise<'success' | 'wrong_password' | 'locked' | 'not_found'> {
  const db = await getDB();
  const record = (await db.get('users', username.toLowerCase())) as UserRecord | undefined;

  if (!record) return 'not_found';

  // Active lockout?
  if (record.lockedUntil !== null && Date.now() < record.lockedUntil) {
    return 'locked';
  }

  // Expired lockout — reset before proceeding
  const baseRecord =
    record.lockedUntil !== null
      ? { ...record, lockedUntil: null, failedAttempts: 0 }
      : record;

  const hash = await hashPassword(password, baseRecord.salt);

  if (hash !== baseRecord.passwordHash) {
    const newAttempts = baseRecord.failedAttempts + 1;
    const lockedUntil = newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
    await db.put('users', { ...baseRecord, failedAttempts: newAttempts, lockedUntil });
    return 'wrong_password';
  }

  // Correct password
  await db.put('users', {
    ...baseRecord,
    lastLoginAt: Date.now(),
    failedAttempts: 0,
    lockedUntil: null,
  });
  return 'success';
}

/** Delete a user account permanently. */
export async function deleteUser(username: string): Promise<void> {
  const db = await getDB();
  await db.delete('users', username.toLowerCase());
}

/**
 * Returns how many minutes remain in the lockout for a user.
 * Returns 0 if the user is not locked.
 */
export async function getLockoutRemainingMinutes(username: string): Promise<number> {
  const record = await getUser(username);
  if (!record?.lockedUntil || Date.now() >= record.lockedUntil) return 0;
  return Math.max(1, Math.ceil((record.lockedUntil - Date.now()) / 60_000));
}

/**
 * Change a user's password after verifying the current one.
 * Generates a fresh salt for the new password.
 * @returns 'success' | 'wrong_password' | 'not_found'
 */
export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<'success' | 'wrong_password' | 'not_found'> {
  const db = await getDB();
  const record = (await db.get('users', username.toLowerCase())) as UserRecord | undefined;
  if (!record) return 'not_found';

  if (newPassword.length < 4) throw new Error('Password must be at least 4 characters.');

  // Verify old password directly (bypass lockout counter for password-change flow)
  const oldHash = await hashPassword(oldPassword, record.salt);
  if (oldHash !== record.passwordHash) return 'wrong_password';

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  await db.put('users', {
    ...record,
    passwordHash: newHash,
    salt: newSalt,
    failedAttempts: 0,
    lockedUntil: null,
  });
  return 'success';
}

/**
 * Update a user's display name and/or avatar.
 * Passing undefined for a field leaves it unchanged.
 */
export async function updateProfile(
  username: string,
  updates: { displayName?: string; avatar?: string }
): Promise<void> {
  const db = await getDB();
  const record = (await db.get('users', username.toLowerCase())) as UserRecord | undefined;
  if (!record) throw new Error('User not found.');

  await db.put('users', {
    ...record,
    ...(updates.displayName !== undefined
      ? { displayName: updates.displayName.trim() || record.displayName }
      : {}),
    ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
  });
}
