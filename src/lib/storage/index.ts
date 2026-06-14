/**
 * Teskel storage backend selector.
 *
 * Picks the right StorageProvider implementation at boot time based on
 * the `PROJECT_STORAGE_BACKEND` env var. The default is the local
 * filesystem (great for development); production deployments set it to
 * `s3` so all project files live in S3-compatible object storage and
 * the application can scale horizontally.
 */
import { localStorageProvider } from "./local-provider";
import { s3StorageProvider } from "./s3-provider";
import type { StorageProvider } from "./provider";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const backend = process.env.PROJECT_STORAGE_BACKEND?.toLowerCase() ?? "local";
  switch (backend) {
    case "s3":
      cached = s3StorageProvider;
      break;
    case "local":
    default:
      cached = localStorageProvider;
      break;
  }
  return cached;
}

/** Test helper: force-reset the cached provider between test runs. */
export function __resetStorageProviderForTests(): void {
  cached = null;
}

export type { StorageProvider, StorageObject } from "./provider";
export { StorageError } from "./provider";
