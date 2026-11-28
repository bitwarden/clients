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

/**
 * Stores the whole state in `data.json`.
 * - Writes go to a temporary file that is fsynced and renamed over `data.json`, so an interrupted
 *   or failed write leaves the previous file in place. Each write uses its own temporary file, so
 *   two processes writing at once can't write into the same one.
 * - A file that doesn't parse to an object is deleted, since it can hold wrapped keys, and the store
 *   starts empty. {@link startupErrors} describes it for logging.
 */
export class JsonFileBackend implements StorageBackend {
  /** Messages for the caller to log, since this backend is created before the log service. */
  readonly startupErrors: string[] = [];

  private readonly filePath: string;
  private readonly fileMode = isWindowsPortable() ? 0o666 : 0o600;
  private data: Record<string, unknown> | null = null;

  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      NodeUtils.mkdirpSync(dir, "700");
    }
    this.filePath = path.join(dir, FILE_NAME);
    this.removeStaleTempFiles();
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
    const errors: string[] = [];
    let modified = "unknown";
    try {
      modified = fs.statSync(this.filePath).mtime.toISOString();
    } catch (error) {
      errors.push(`Failed to read the storage file's last write time: ${error}`);
    }
    let outcome = "deleted it";
    try {
      fs.rmSync(this.filePath, { force: true });
    } catch (error) {
      outcome = "failed to delete it";
      errors.push(`Failed to delete the storage file: ${error}`);
    }
    this.startupErrors.push(
      `Storage file was not a JSON object (${describeCorruptFile(text)}, last written ${modified}), ${outcome} and started empty`,
      ...errors,
    );
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

/**
 * Describes the text without quoting it. Runs only after {@link parseObject} fails, so it parses
 * the text again to get the error.
 */
function describeCorruptFile(text: string): string {
  let problem: string;
  if (text.length === 0) {
    problem = "empty";
  } else if (/^\0+$/.test(text)) {
    problem = "only NUL characters";
  } else if (text.trim().length === 0) {
    problem = "only whitespace";
  } else {
    try {
      const parsed: unknown = JSON.parse(text);
      let jsonType: string;
      if (parsed === null) {
        jsonType = "null";
      } else if (Array.isArray(parsed)) {
        jsonType = "array";
      } else {
        jsonType = typeof parsed;
      }
      problem = `JSON ${jsonType}`;
    } catch (error) {
      const position = parseErrorPosition(error, text.length);
      problem =
        position != null
          ? `invalid JSON, parsing failed at character ${position}`
          : "invalid JSON, parser gave no position";
    }
  }
  const size = Buffer.byteLength(text, "utf8");
  const nulCount = text.split("\0").length - 1;
  return `${problem}, ${text.length} characters, ${size} bytes, ${nulCount} NUL characters`;
}

/** Reads only the offset from the parse error. The rest of its message can quote file contents. */
function parseErrorPosition(error: unknown, length: number): number | null {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("end of JSON input")) {
    return length;
  }
  const match = /at position (\d+)/.exec(message);
  return match != null ? Number(match[1]) : null;
}
