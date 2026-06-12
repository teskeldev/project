import { describe, it, expect, beforeAll, vi } from "vitest";

// crypto.ts imports ApiError from "@/lib/api" (-> "@/auth" -> NextAuth).
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

// A deterministic test key MUST be set before the module under test derives it.
beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    "test-encryption-key-please-change-32chars-minimum-0123456789";
});

import { encrypt, decrypt, encryptJson, decryptJson } from "@/lib/crypto";
import { ApiError } from "@/lib/api";

describe("crypto AES-256-GCM", () => {
  it("roundtrips encrypt -> decrypt", () => {
    const plaintext = "sk-super-secret-api-key-value";
    const payload = encrypt(plaintext);
    expect(decrypt(payload)).toBe(plaintext);
  });

  it("produces ciphertext that differs from the plaintext", () => {
    const plaintext = "hello world";
    const payload = encrypt(plaintext);
    expect(payload).not.toBe(plaintext);
    expect(payload).not.toContain(plaintext);
  });

  it("uses a random IV so two encryptions of the same plaintext differ", () => {
    const plaintext = "same-input-every-time";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // ...but both still decrypt back to the original.
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("throws on a tampered payload (auth tag mismatch)", () => {
    const payload = encrypt("integrity matters");
    const raw = Buffer.from(payload, "base64");
    // Flip a byte in the ciphertext region (after IV+tag = 28 bytes).
    raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff;
    const tampered = raw.toString("base64");
    expect(() => decrypt(tampered)).toThrowError(ApiError);
  });

  it("throws on a truncated / malformed payload", () => {
    expect(() => decrypt("too-short")).toThrowError(ApiError);
    expect(() => decrypt("")).toThrowError(ApiError);
  });

  it("roundtrips JSON objects", () => {
    const value = { apiKey: "sk-123", model: "gpt-4o-mini", nested: { a: 1 } };
    const payload = encryptJson(value);
    expect(decryptJson<typeof value>(payload)).toEqual(value);
  });
});
