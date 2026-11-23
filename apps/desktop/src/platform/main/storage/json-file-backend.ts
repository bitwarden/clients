import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

import { NodeUtils } from "@bitwarden/node/node-utils";

import { isWindowsPortable } from "../../../main/platform-utils.main";

import { StorageBackend } from "./storage-backend";

const FILE_NAME = "data.json";
const TEMP_PREFIX = `${FILE_NAME}.tmp-`;
// Another process can be mid-write. Mac App Store builds skip the single-instance lock.
const STALE_TEMP_MS = 60_000;
const CORRUPT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stores the whole state in `data.json`.
 * - Writes go to a temporary file that is fsynced and renamed over `data.json`, so an interrupted
 *   or failed write leaves the previous file in place. Each write uses its own temporary file, so
 *   two processes writing at once can't write into the same one.
 * - A file that doesn't parse to an object is moved to `data.json.corrupt`, replacing any earlier
 *   copy, and the store starts empty. {@link corruptFileSize} reports it for logging. The copy is
 *   kept for diagnostics and deleted once it's older than 30 days, since it holds wrapped keys.
 */
export class JsonFileBackend implements StorageBackend {
  /** Size in bytes of the file that {@link read} moved aside, if it did. */
  corruptFileSize: number | null = null;

  private readonly filePath: string;
  private readonly corruptPath: string;
  private readonly fileMode = isWindowsPortable() ? 0o666 : 0o600;
  private data: Record<string, unknown> | null = null;

  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      NodeUtils.mkdirpSync(dir, "700");
    }
    this.filePath = path.join(dir, FILE_NAME);
    this.corruptPath = `${this.filePath}.corrupt`;
    this.removeStaleTempFiles();
    this.removeOldCorruptFile();
  }

  read(): Record<string, unknown> {
    this.data ??= this.load();
    return { ...this.data };
  }

  update(updater: (store: Record<string, unknown>) => Record<string, unknown>): void {
    const data = updater(this.read());
    this.write(data);
    this.data = data;
  }

  flush(): void {
    // Writes are synchronous, nothing to flush.
  }

  private load(): Record<string, unknown> {
    let text: string;
    try {
      text = fs.readFileSync(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return {};
      }
      throw error;
    }

    const parsed = parseObject(text);
    if (parsed != null) {
      return parsed;
    }
    fs.renameSync(this.filePath, this.corruptPath);
    // The rename keeps the last write time, so the 30 days count from the recovery instead.
    const now = new Date();
    fs.utimesSync(this.corruptPath, now, now);
    this.corruptFileSize = Buffer.byteLength(text, "utf8");
    return {};
  }

  private write(data: Record<string, unknown>): void {
    const json = JSON.stringify(data, undefined, "\t");
    const tempPath = path.join(
      this.dir,
      `${TEMP_PREFIX}${process.pid}-${randomBytes(4).toString("hex")}`,
    );
    let fd: number | null = null;
    try {
      fd = fs.openSync(tempPath, "wx", this.fileMode);
      // writeFileSync on a file descriptor keeps writing until every byte is written.
      fs.writeFileSync(fd, json, "utf8");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      if (fd != null) {
        fs.closeSync(fd);
      }
      fs.rmSync(tempPath, { force: true });
      throw error;
    }

    // Persist the rename itself. Windows can't open a directory for fsync.
    if (process.platform !== "win32") {
      const dirFd = fs.openSync(this.dir, "r");
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
    }
  }

  private removeOldCorruptFile(): void {
    const stats = fs.statSync(this.corruptPath, { throwIfNoEntry: false });
    if (stats != null && stats.mtimeMs < Date.now() - CORRUPT_MAX_AGE_MS) {
      fs.rmSync(this.corruptPath, { force: true });
    }
  }

  /** Removes temporary files left behind by interrupted writes. */
  private removeStaleTempFiles(): void {
    const cutoff = Date.now() - STALE_TEMP_MS;
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.startsWith(TEMP_PREFIX)) {
        continue;
      }
      const tempPath = path.join(this.dir, name);
      const stats = fs.statSync(tempPath, { throwIfNoEntry: false });
      if (stats != null && stats.mtimeMs < cutoff) {
        fs.rmSync(tempPath, { force: true });
      }
    }
  }
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Handled by the caller as a corrupt file.
  }
  return null;
}
