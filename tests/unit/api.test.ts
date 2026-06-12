import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// api.ts imports "@/auth" (NextAuth) and "@/lib/db" (Prisma). Mock both so the
// pure helpers (apiSuccess/apiError/handleApiError/validateBody) run without a
// session or database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  ApiError,
  apiSuccess,
  apiError,
  handleApiError,
  validateBody,
} from "@/lib/api";

describe("apiSuccess", () => {
  it("returns a 200 { success: true, data } body by default", async () => {
    const res = apiSuccess({ hello: "world" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: { hello: "world" } });
  });

  it("honors a custom status code", async () => {
    const res = apiSuccess({ id: "1" }, { status: 201 });
    expect(res.status).toBe(201);
  });
});

describe("apiError", () => {
  it("returns { success: false, error: { message } }", async () => {
    const res = apiError("Nope", 400, "BAD");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("Nope");
    expect(json.error.code).toBe("BAD");
  });

  it("omits details in production", async () => {
    const prev = process.env.NODE_ENV;
    try {
      // @ts-expect-error - overriding readonly NODE_ENV for the test
      process.env.NODE_ENV = "production";
      const res = apiError("Boom", 500, "X", { secret: 1 });
      const json = await res.json();
      expect(json.error.details).toBeUndefined();
    } finally {
      // @ts-expect-error - restore
      process.env.NODE_ENV = prev;
    }
  });
});

describe("handleApiError", () => {
  it("maps an ApiError to its status/code", async () => {
    const res = handleApiError(new ApiError("Not found", 404, "NOT_FOUND"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toBe("Not found");
  });

  it("maps a ZodError to a 422 VALIDATION_ERROR", async () => {
    const schema = z.object({ name: z.string() });
    const parsed = schema.safeParse({ name: 123 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const res = handleApiError(parsed.error);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("maps an unknown error to 500 INTERNAL_ERROR", async () => {
    const res = handleApiError(new Error("kaboom"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});

/** Build a fake Request whose json() resolves to the given body. */
function fakeRequest(body: unknown, opts?: { invalid?: boolean }): Request {
  return {
    json: async () => {
      if (opts?.invalid) throw new SyntaxError("bad json");
      return body;
    },
  } as unknown as Request;
}

describe("validateBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });

  it("returns parsed data on a valid body", async () => {
    const req = fakeRequest({ name: "Ada", age: 36 });
    const data = await validateBody(req, schema);
    expect(data).toEqual({ name: "Ada", age: 36 });
  });

  it("throws ApiError(422) on schema mismatch", async () => {
    const req = fakeRequest({ name: "", age: "old" });
    await expect(validateBody(req, schema)).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("throws ApiError(400) on invalid JSON", async () => {
    const req = fakeRequest(null, { invalid: true });
    await expect(validateBody(req, schema)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    });
  });
});
