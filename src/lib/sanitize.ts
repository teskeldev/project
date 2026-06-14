/**
 * Input sanitization utilities — safe to import from both server and client.
 *
 * These are pure functions with no dependency on server secrets, environment
 * variables, or Node.js APIs. They can safely be used in React client
 * components, Edge middleware, and server route handlers.
 */

// ---------------------------------------------------------------------------
// HTML Escaping (XSS Prevention)
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

const HTML_ESCAPE_REGEX = /[&<>"'`/]/g;

/**
 * Escapes HTML special characters to prevent XSS in user-generated content.
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Strips all HTML tags from a string, leaving only text content.
 */
export function stripHtmlTags(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "");
}

// ---------------------------------------------------------------------------
// URL Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes a string for safe use in URLs (removes javascript: and data: schemes).
 * Returns the URL if safe, or an empty string if potentially dangerous.
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  const normalizedDecoded = decoded.toLowerCase().replace(/[\s\x00-\x1f]/g, "");
  const normalizedOriginal = trimmed.toLowerCase().replace(/[\s\x00-\x1f]/g, "");

  const dangerousSchemes = ["javascript:", "vbscript:"];
  for (const scheme of dangerousSchemes) {
    if (normalizedDecoded.startsWith(scheme) || normalizedOriginal.startsWith(scheme)) {
      return "";
    }
  }

  if (normalizedDecoded.startsWith("data:") || normalizedOriginal.startsWith("data:")) {
    const dataMatch = normalizedDecoded.startsWith("data:")
      ? normalizedDecoded
      : normalizedOriginal;
    if (!dataMatch.startsWith("data:image/")) {
      return "";
    }
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// General Input Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes user input by trimming whitespace, removing null bytes,
 * and optionally escaping HTML. Suitable for general text fields.
 */
export function sanitizeInput(
  input: string,
  options: { escapeHtml?: boolean; maxLength?: number } = {}
): string {
  if (!input || typeof input !== "string") return "";

  const { escapeHtml: shouldEscape = true, maxLength } = options;

  let sanitized = input.replace(/\0/g, "");
  sanitized = sanitized.trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  if (shouldEscape) {
    sanitized = escapeHtml(sanitized);
  }

  return sanitized;
}
