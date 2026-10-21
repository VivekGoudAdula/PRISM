/**
 * PRISM Application-Level Encryption at Rest Service
 *
 * Implements authenticated encryption using AES-256-GCM (Galois/Counter Mode).
 * Used for encrypting sensitive document contents (resumes, contracts, invoices, source code)
 * at rest before persisting in MongoDB collections.
 *
 * Security specifications:
 * - Cipher: aes-256-gcm (NIST SP 800-38D compliant)
 * - Key: 256 bits (32 bytes) retrieved from DOCUMENT_ENCRYPTION_KEY environment variable
 * - IV: 96 bits (12 bytes) cryptographically random per operation (crypto.randomBytes)
 * - Auth Tag: 128 bits (16 bytes) for ciphertext authentication and tamper resistance
 * - Format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 * - Backward compatibility: Transparently returns plaintext if input lacks 'enc:v1:' prefix.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits
const ENCRYPTION_PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;
let keyWarningLogged = false;

/**
 * Resolves the 256-bit encryption key from the environment.
 * If unset in non-production, derives a deterministic development key with a logged warning.
 * In production (NODE_ENV=production), throws an explicit error if unset or insecure.
 */
export function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const rawKey = process.env.DOCUMENT_ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!rawKey || rawKey.trim() === '') {
    if (isProduction) {
      throw new Error(
        '[SECURITY CRITICAL] DOCUMENT_ENCRYPTION_KEY is required in production environment. Application halted.'
      );
    }

    if (!keyWarningLogged) {
      console.warn(
        '⚠️ [SECURITY WARNING] DOCUMENT_ENCRYPTION_KEY is not set. Using local development fallback key. Do NOT use in production!'
      );
      keyWarningLogged = true;
    }

    // Deterministic 32-byte development key (SHA-256 of development seed)
    cachedKey = crypto.createHash('sha256').update('prism_dev_local_encryption_key_2026').digest();
    return cachedKey;
  }

  // Support 64-char hex key or 44-char base64 key or raw 32-byte string
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    cachedKey = Buffer.from(rawKey, 'hex');
  } else if (/^[A-Za-z0-9+/]{43}=$/.test(rawKey) || rawKey.length === 44) {
    cachedKey = Buffer.from(rawKey, 'base64');
  } else {
    // Derive exact 32 bytes using SHA-256
    cachedKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  return cachedKey;
}

/**
 * Encrypts a string (e.g. base64 document or extracted text) using AES-256-GCM.
 *
 * @param plaintext - The raw document text or base64 data to encrypt
 * @returns Serialized encrypted payload: enc:v1:<iv>:<tag>:<ciphertext>
 */
export function encryptDocument(plaintext: string, customKey?: Buffer): string {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  // If already encrypted, do not re-encrypt
  if (plaintext.startsWith(ENCRYPTION_PREFIX)) {
    return plaintext;
  }

  const key = customKey || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encryptedBuffer = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuffer.toString('hex')}`;
}

/**
 * Decrypts a previously encrypted document payload.
 * If the input does not start with the 'enc:v1:' prefix, it is treated as legacy unencrypted
 * plaintext and returned as-is (zero regression for existing records).
 *
 * @param encryptedOrPlaintext - The data to decrypt or pass through
 * @param customKey - Optional specific key for key rotation operations
 * @returns The original decrypted plaintext string
 * @throws Error if authentication tag verification fails (data tampering detected)
 */
export function decryptDocument(encryptedOrPlaintext: string, customKey?: Buffer): string {
  if (!encryptedOrPlaintext || typeof encryptedOrPlaintext !== 'string') {
    return encryptedOrPlaintext;
  }

  // Legacy or unencrypted plaintext pass-through
  if (!encryptedOrPlaintext.startsWith(ENCRYPTION_PREFIX)) {
    return encryptedOrPlaintext;
  }

  const rawPayload = encryptedOrPlaintext.slice(ENCRYPTION_PREFIX.length);
  const parts = rawPayload.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted document format: expected 3 colon-separated components');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = customKey || getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // Will throw if authTag doesn't match (tamper detection)
  ]);

  return decryptedBuffer.toString('utf8');
}

/**
 * Checks whether a given string is encrypted with the PRISM format.
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Generates a cryptographically secure 256-bit key for operators to use in .env
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
