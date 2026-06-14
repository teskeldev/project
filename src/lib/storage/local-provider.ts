/**
 * Local filesystem implementation of `StorageProvider`.
 *
 * Backed by the `.teskel-storage/` directory (configurable via the
 * `PROJECT_STORAGE_DIR` environment variable). The provider assumes the
 * project root for a given `storageKey` is `STORAGE_DIR/<storageKey>`.
 *
 * All paths MUST come from `resolveSafe` / `normalizeRelPath` upstream —
 * the provider does no traversal checks of its own.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { StorageError, type StorageProvider } from "./provider";

const STORAGE_DIR = path.resolve(
  process.env.PROJECT_STORAGE_DIR ?? "./.teskel-storage"
);

function projectRoot(storageKey: string): string {
  if (!storageKey || /[\\/]|\0|\.\./.test(storageKey)) {
    throw new StorageError("Invalid storage key", "INVALID_PATH", 400);
  }
  return path.resolve(STORAGE_DIR, storageKey);
}

function toFsPath(storageKey: string, relPath: string): string {
  // Caller has already passed a project-relative POSIX path through
  // resolveSafe; we just join it onto the project root.
  return path.resolve(projectRoot(storageKey), relPath);
}

export const localStorageProvider: StorageProvider = {
  name: "local",

  async write(storageKey, relPath, body) {
    const abs = toFsPath(storageKey, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
  },

  async read(storageKey, relPath) {
    const abs = toFsPath(storageKey, relPath);
    try {
      return new Uint8Array(await fs.readFile(abs));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        throw new StorageError("File not found", "NOT_FOUND", 404);
      }
      throw new StorageError(
        e.message ?? "Read failed",
        "STORAGE_READ_FAILED",
        500
      );
    }
  },

  async exists(storageKey, relPath) {
    const abs = toFsPath(storageKey, relPath);
    try {
      await fs.stat(abs);
      return true;
    } catch {
      return false;
    }
  },

  async remove(storageKey, relPath) {
    const abs = toFsPath(storageKey, relPath);
    await fs.rm(abs, { recursive: true, force: true });
  },

  async createDir(storageKey, relPath) {
    const abs = toFsPath(storageKey, relPath);
    await fs.mkdir(abs, { recursive: true });
  },

  async purgeProject(storageKey) {
    const root = projectRoot(storageKey);
    await fs.rm(root, { recursive: true, force: true });
  },
};
