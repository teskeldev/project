/**
 * Teskel Storage Provider Abstraction
 *
 * The Teskel workspace stores project file content (and other blob-like
 * data) behind a small, swappable provider interface. This lets the
 * application run against the local filesystem during development, and
 * switch to S3-compatible object storage (R2, S3, MinIO, etc.) for
 * stateless, horizontally-scalable production deployments — without
 * changing call sites in the application code.
 *
 * Provider selection is environment-driven:
 *   - PROJECT_STORAGE_BACKEND=local (default) -> LocalFileStorageProvider
 *   - PROJECT_STORAGE_BACKEND=s3              -> S3StorageProvider
 *
 * Both providers MUST implement the same interface so route handlers and
 * domain code can stay backend-agnostic.
 */

/**
 * A single storage object. The `key` is opaque to the consumer — it is
 * the provider's internal addressing for the object.
 */
export type StorageObject = {
  /** Bytes (utf-8) of the object. */
  body: Uint8Array;
  /** Provider-defined content type, if known. */
  contentType?: string;
};

/**
 * Provider-agnostic storage interface. All methods are async; all errors
 * are thrown as `StorageError` so the caller can branch consistently.
 */
export interface StorageProvider {
  /** Stable identifier for the provider (e.g. "local", "s3"). */
  readonly name: string;

  /**
   * Write `body` to the given project-relative path inside `storageKey`.
   * The path is expected to be a SAFE project-relative path — the caller
   * has already run it through `resolveSafe`/`normalizeRelPath`.
   */
  write(storageKey: string, relPath: string, body: Uint8Array): Promise<void>;

  /** Read the file at `relPath`. Throws StorageError(404) when missing. */
  read(storageKey: string, relPath: string): Promise<Uint8Array>;

  /** Whether a file exists at `relPath` in `storageKey`. */
  exists(storageKey: string, relPath: string): Promise<boolean>;

  /** Recursively remove `relPath`. Idempotent. */
  remove(storageKey: string, relPath: string): Promise<void>;

  /**
   * Create a directory entry at `relPath`. Idempotent.
   * The local provider needs this for `mkdir -p` semantics; S3 is flat
   * (object keys are namespaced) and the operation is a no-op there.
   */
  createDir(storageKey: string, relPath: string): Promise<void>;

  /**
   * Recursively remove ALL files for `storageKey` (used by project delete
   * sweeps). The local provider removes the directory; the S3 provider
   * lists and deletes by prefix.
   */
  purgeProject(storageKey: string): Promise<void>;
}

/**
 * Error type used by every storage provider. Wraps the underlying
 * platform error (ENOENT, ETIMEDOUT, 4xx/5xx) with a stable code.
 */
export class StorageError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number = 500) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.status = status;
  }
}
