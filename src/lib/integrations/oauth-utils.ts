/**
 * PKCE (Proof Key for Code Exchange) helpers.
 * SERVER-ONLY: uses node:crypto.
 */
import { createHash, randomBytes } from "node:crypto";

/** Cryptographically random URL-safe base64 string. */
export function randomBase64url(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** S256 code challenge: BASE64URL(SHA256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}
