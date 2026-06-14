import { ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// CSRF Token Generation & Validation (Web Crypto for Edge Runtime compatibility)
// ---------------------------------------------------------------------------

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || "";
const CSRF_TOKEN_LENGTH = 32;

// Eagerly validate at module load time – fail fast if the secret is missing.
if (!CSRF_SECRET) {
  throw new Error(
    "CSRF_SECRET or NEXTAUTH_SECRET environment variable must be set. " +
    "Cannot start the application without a CSRF signing secret."
  );
}

function requireCsrfSecret(): string {
  return CSRF_SECRET;
}

/** Helper to convert Uint8Array to hex string */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Helper to convert hex string to Uint8Array */
function hexToBuffer(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Get a Web Crypto HMAC key from the secret string */
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Generates a CSRF token consisting of a random value and its HMAC signature.
 * Format: `<random>.<signature>`
 */
export async function generateCsrfToken(): Promise<string> {
  const secret = requireCsrfSecret();
  const randomBytes = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(randomBytes);
  const tokenValue = bufferToHex(randomBytes.buffer);

  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(tokenValue)
  );
  const signature = bufferToHex(signatureBuffer);
  
  return `${tokenValue}.${signature}`;
}

/**
 * Validates a CSRF token by verifying its HMAC signature.
 * Uses Web Crypto API for timing-safe signature verification.
 */
export async function validateCsrfToken(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [tokenValue, providedSignature] = parts;
  if (!tokenValue || !providedSignature) return false;

  try {
    const secret = requireCsrfSecret();
    const key = await getHmacKey(secret);
    const signatureBytes = hexToBuffer(providedSignature);
    
    // crypto.subtle.verify is inherently timing-safe
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(tokenValue)
    );
    return isValid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CSRF Middleware (Double-Submit Cookie Pattern)
// ---------------------------------------------------------------------------

/**
 * HTTP methods that may mutate server state. CSRF checks are required for these.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Parses the `csrf` cookie from a raw `Cookie` header. Returns the token value
 * (URL-decoded) or null if absent.
 */
function readCsrfCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)csrf=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Validates a CSRF request using the double-submit cookie pattern.
 */
export async function requireCsrf(req: Request): Promise<void> {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) return;

  const headerToken =
    req.headers.get("x-csrf-token") ?? req.headers.get("X-CSRF-Token") ?? null;

  let bodyToken: string | null = null;
  if (!headerToken) {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const cloned = req.clone();
        const form = await cloned.formData();
        const value = form.get("csrf");
        if (typeof value === "string") bodyToken = value;
      } catch {
        // Fall through
      }
    }
  }

  const submittedToken = headerToken ?? bodyToken;
  if (!submittedToken) {
    throw new ApiError("CSRF token missing", 403, "CSRF_TOKEN_MISSING");
  }

  const cookieToken = readCsrfCookie(req);
  if (!cookieToken) {
    throw new ApiError("CSRF cookie missing", 403, "CSRF_COOKIE_MISSING");
  }

  const isSubmittedValid = await validateCsrfToken(submittedToken);
  const isCookieValid = await validateCsrfToken(cookieToken);

  if (!isSubmittedValid || !isCookieValid || submittedToken !== cookieToken) {
    throw new ApiError("Invalid CSRF token", 403, "CSRF_TOKEN_INVALID");
  }
}

// ---------------------------------------------------------------------------
// Input Sanitization (XSS Prevention)
//
// Re-exported from @/lib/sanitize for backward compatibility. Client code
// should prefer importing from @/lib/sanitize directly to avoid pulling in
// the CSRF module (which requires server-only env vars).
// ---------------------------------------------------------------------------

export {
  escapeHtml,
  stripHtmlTags,
  sanitizeUrl,
  sanitizeInput,
} from "@/lib/sanitize";
