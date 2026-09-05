// ─────────────────────────────────────────────────────────────
// SecureOS Virtual File System — Vault Encryption
// ─────────────────────────────────────────────────────────────
// Implements AES-256-GCM authenticated encryption for files
// under `/vault/`. Keys are derived from a user-supplied
// password using PBKDF2 (100,000 iterations).
//
// The ciphertext and IV are base64-encoded to be stored
// safely in the `string` fields of FSNode.
// ─────────────────────────────────────────────────────────────

/**
 * Helper to encode Uint8Array to base64.
 * (Browser's btoa works on strings, so we convert first)
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Helper to decode base64 to Uint8Array.
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-256-GCM key from a master password using PBKDF2.
 */
export async function deriveVaultKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  // Import the password as a raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the actual AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-GCM.
 *
 * @returns An object containing the base64-encoded ciphertext, salt, and IV.
 */
export async function encryptContent(plaintext: string, password: string): Promise<{ ciphertextBase64: string; saltHex: string; ivHex: string }> {
  // Generate random salt (16 bytes) and IV (12 bytes for GCM)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveVaultKey(password, salt);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Encrypt with AES-GCM (this produces ciphertext + auth tag seamlessly)
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Convert binary data to hex/base64 strings for storage
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const ciphertextBase64 = bufferToBase64(encryptedBuffer);

  return { ciphertextBase64, saltHex, ivHex };
}

/**
 * Decrypt a base64-encoded ciphertext string using AES-GCM.
 *
 * @throws If the password is wrong or the ciphertext was tampered with (Auth Tag verification fails).
 */
export async function decryptContent(ciphertextBase64: string, password: string, saltHex: string, ivHex: string): Promise<string> {
  // Parse hex strings back to Uint8Arrays
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const ciphertextBuffer = base64ToBuffer(ciphertextBase64);

  const key = await deriveVaultKey(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    // SubtleCrypto throws a generic DOMException 'OperationError' if the password is wrong
    // or if the ciphertext is tampered with (due to GCM's auth tag).
    throw new Error('DECRYPTION_FAILED');
  }
}
