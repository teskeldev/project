/**
 * S3-compatible implementation of `StorageProvider`.
 *
 * Targets any S3-v4 API surface — AWS S3, Cloudflare R2, MinIO, Backblaze B2,
 * etc. Provider selection is environment-driven. Authentication uses
 * the standard AWS Signature V4 algorithm (no SDK dependency) and a
 * kept-fresh `undici` fetch for HTTP I/O.
 *
 * Configuration (see .env.example):
 *   PROJECT_STORAGE_BACKEND=s3
 *   S3_ENDPOINT        (e.g. "https://s3.us-east-1.amazonaws.com")
 *   S3_REGION          (e.g. "us-east-1")
 *   S3_BUCKET          (e.g. "teskel-projects")
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE (optional; true for MinIO)
 *
 * Keys are namespaced under `<storageKey>/<relPath>` so the same bucket
 * can host many projects without collisions.
 */
import { createHash, createHmac } from "node:crypto";
import { fetch as undiciFetch } from "undici";
import { StorageError, type StorageProvider } from "./provider";

/** SHA-256 hex digest helper. */
function sha256Hex(input: string | Uint8Array): string {
  const h = createHash("sha256");
  h.update(input as never);
  return h.digest("hex");
}

function hmacSha256(key: Uint8Array, data: string): Uint8Array {
  return new Uint8Array(createHmac("sha256", key).update(data).digest());
}

function toAmzDate(date = new Date()): { date: string; datetime: string } {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    datetime:
      `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
      `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`,
  };
}

function uriEncode(input: string, encodeSlash = true): string {
  return encodeURIComponent(input).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%2F/g, encodeSlash ? "%2F" : "/");
}

function deriveSigningKey(
  secret: string,
  date: string,
  region: string,
  service: string
): Uint8Array {
  const kDate = hmacSha256(new TextEncoder().encode("AWS4" + secret), date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

/** Read configuration from the environment. Throws when misconfigured. */
function readConfig() {
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
  const region = process.env.S3_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new StorageError(
      "S3 storage backend is not fully configured (S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY required)",
      "STORAGE_MISCONFIGURED",
      500
    );
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle };
}

type SignedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Uint8Array | null;
};

/** Build an AWS SigV4-signed request. */
function signRequest(
  cfg: ReturnType<typeof readConfig>,
  method: string,
  key: string,
  body: Uint8Array | null,
  extraHeaders: Record<string, string> = {}
): SignedRequest {
  const { date, datetime } = toAmzDate();
  const host = cfg.forcePathStyle
    ? new URL(cfg.endpoint).host
    : `${cfg.bucket}.${new URL(cfg.endpoint).host.replace(/^[^/]+/, "")}` || cfg.bucket;
  const canonicalUri = cfg.forcePathStyle
    ? `/${cfg.bucket}/${uriEncode(key)}`
    : `/${uriEncode(key)}`;
  const canonicalQuery = "";
  const payloadHash = sha256Hex(body ?? "");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
    ...extraHeaders,
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders =
    sortedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${date}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveSigningKey(
    cfg.secretAccessKey,
    date,
    cfg.region,
    "s3"
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    url: cfg.forcePathStyle
      ? `${cfg.endpoint}/${cfg.bucket}/${uriEncode(key)}`
      : `${cfg.endpoint}/${uriEncode(key)}`,
    method,
    headers: {
      ...headers,
      Authorization: authHeader,
    },
    body,
  };
}

export const s3StorageProvider: StorageProvider = {
  name: "s3",

  async write(storageKey, relPath, body) {
    const cfg = readConfig();
    const key = `${storageKey}/${relPath}`.replace(/^\/+/, "");
    const req = signRequest(cfg, "PUT", key, body, {
      "content-type": "application/octet-stream",
      "content-length": String(body.byteLength),
    });
    const res = await undiciFetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body ?? undefined,
    });
    if (!res.ok) {
      throw new StorageError(
        `S3 PUT failed: ${res.status}`,
        "STORAGE_WRITE_FAILED",
        500
      );
    }
  },

  async read(storageKey, relPath) {
    const cfg = readConfig();
    const key = `${storageKey}/${relPath}`.replace(/^\/+/, "");
    const req = signRequest(cfg, "GET", key, null);
    const res = await undiciFetch(req.url, {
      method: req.method,
      headers: req.headers,
    });
    if (res.status === 404) {
      throw new StorageError("File not found", "NOT_FOUND", 404);
    }
    if (!res.ok) {
      throw new StorageError(
        `S3 GET failed: ${res.status}`,
        "STORAGE_READ_FAILED",
        500
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  },

  async exists(storageKey, relPath) {
    const cfg = readConfig();
    const key = `${storageKey}/${relPath}`.replace(/^\/+/, "");
    const req = signRequest(cfg, "HEAD", key, null);
    const res = await undiciFetch(req.url, {
      method: req.method,
      headers: req.headers,
    });
    return res.ok;
  },

  async remove(storageKey, relPath) {
    const cfg = readConfig();
    const key = `${storageKey}/${relPath}`.replace(/^\/+/, "");
    const req = signRequest(cfg, "DELETE", key, null);
    const res = await undiciFetch(req.url, {
      method: req.method,
      headers: req.headers,
    });
    if (!res.ok && res.status !== 404) {
      throw new StorageError(
        `S3 DELETE failed: ${res.status}`,
        "STORAGE_DELETE_FAILED",
        500
      );
    }
  },

  async createDir() {
    // S3 is flat; the PUT call from `write` creates the object regardless
    // of any "parent directory" prefix. No-op.
  },

  async purgeProject(storageKey) {
    const cfg = readConfig();
    const prefix = `${storageKey}/`;
    // List under prefix, then delete each key in batches of up to 1000.
    let continuationToken: string | undefined;
    do {
      const params = new URLSearchParams({
        "list-type": "2",
        prefix,
        "max-keys": "1000",
      });
      if (continuationToken) params.set("continuation-token", continuationToken);
      const listUrl = cfg.forcePathStyle
        ? `${cfg.endpoint}/${cfg.bucket}?${params.toString()}`
        : `${cfg.endpoint}?${params.toString()}`;
      const req = signRequest(cfg, "GET", "", null, {
        host: new URL(cfg.endpoint).host,
      });
      const res = await undiciFetch(listUrl, { method: "GET", headers: req.headers });
      if (!res.ok) {
        throw new StorageError(
          `S3 list failed: ${res.status}`,
          "STORAGE_LIST_FAILED",
          500
        );
      }
      const xml = await res.text();
      const keys = Array.from(
        xml.matchAll(/<Key>([^<]+)<\/Key>/g),
        (m) => m[1]
      );
      for (const k of keys) {
        const delReq = signRequest(cfg, "DELETE", k, null);
        await undiciFetch(delReq.url, { method: "DELETE", headers: delReq.headers });
      }
      const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      continuationToken = next?.[1];
    } while (continuationToken);
  },
};

// Type-only re-export so static analysis can confirm the shape.
export type { StorageProvider } from "./provider";
