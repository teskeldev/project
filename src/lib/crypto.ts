/**
 * Teskel symmetric encryption helpers (AES-256-GCM).
 *
 * SERVER-ONLY: this module reads ENCRYPTION_KEY from the environment and uses
 * Node's `crypto`. It must NEVER be imported by client components. It is used
 * to encrypt integration secrets (API keys, tokens) at rest in the database.
 *
 * SECURITY:
 *   - The 32-byte AES key is derived from process.env.ENCRYPTION_KEY via SHA-256
 *     (deterministic, no per-record salt needed for our at-rest use case).
 *   - Each encryption uses a fresh random 12-byte IV (GCM nonce).
 *   - The GCM auth tag guarantees integrity/authenticity on decrypt.
 *   - We NEVER log the key, the plaintext, or the derived key material.
 *   - The derived key is cached in module scope to avoid re-hashing on every call.
 *
 * Wire format (base64):  [ 12-byte IV | 16-byte authTag | ciphertext ]
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { ApiError } from "@/lib/api";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the recommended size for GCM.
const AUTH_TAG_LENGTH = 16; // 128-bit GCM tag.

/** Cached derived key — computed once on first use. */
let cachedKey: Buffer | null = null;

/**
 * Derive a stable 32-byte key from ENCRYPTION_KEY.
 * Caches the result in module scope after first derivation.
 * Throws ApiError(500) if the env var is missing/empty so callers fail safe.
 */
function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.trim().length === 0) {
    // Do NOT include any key material in the error.
    throw new ApiError(
      "Encryption is not configured on the server.",
      500,
      "ENCRYPTION_NOT_CONFIGURED"
    );
  }
  // SHA-256 yields exactly 32 bytes, suitable for AES-256.
  cachedKey = createHash("sha256").update(secret, "utf8").digest();
  return cachedKey;
}

/**
 * Encrypt a UTF-8 plaintext string. Returns a base64 payload that bundles the
 * IV, auth tag, and ciphertext. Safe to store directly in a Text column.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a base64 payload produced by `encrypt`. Throws ApiError(500) on a
 * malformed payload or failed authentication (tampering / wrong key).
 */
export function decrypt(payload: string): string {
  const key = deriveKey();

  let raw: Buffer;
  try {
    raw = Buffer.from(payload, "base64");
  } catch {
    throw new ApiError(
      "Failed to decrypt stored configuration.",
      500,
      "DECRYPT_FAILED"
    );
  }

  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new ApiError(
      "Failed to decrypt stored configuration.",
      500,
      "DECRYPT_FAILED"
    );
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext. Never leak details.
    throw new ApiError(
      "Failed to decrypt stored configuration.",
      500,
      "DECRYPT_FAILED"
    );
  }
}

/** Encrypt an arbitrary JSON-serializable object. */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

/** Decrypt a payload produced by `encryptJson` back into a typed object. */
export function decryptJson<T = unknown>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
