import { createHash, randomBytes } from "crypto";
import { constants as fsConstants, promises as fs } from "fs";
import * as path from "path";

/**
 * File-system primitives for SSH agent setup. Every write goes through `atomicWriteFile` after
 * `checkPathSafety` has accepted the target and each parent directory up to the home directory.
 */

export const SshAgentSetupBlockedReason = Object.freeze({
  Symlink: "sshAgentSetupBlockedSymlink",
  Owner: "sshAgentSetupBlockedOwner",
  Permissions: "sshAgentSetupBlockedPermissions",
  NotRegularFile: "sshAgentSetupBlockedNotRegularFile",
  OutsideHome: "sshAgentSetupBlockedOutsideHome",
  TooLarge: "sshAgentSetupBlockedFileTooLarge",
  Unreadable: "sshAgentSetupBlockedUnreadable",
  UnsafeSocketPath: "sshAgentSetupBlockedUnsafeSocketPath",
  NoSocketAddress: "sshAgentSetupBlockedNoSocketAddress",
  ManagedBlockModified: "sshAgentSetupBlockedManagedBlockModified",
} as const);
export type SshAgentSetupBlockedReason =
  (typeof SshAgentSetupBlockedReason)[keyof typeof SshAgentSetupBlockedReason];

export const MAX_MANAGED_FILE_BYTES = 1024 * 1024;
export const MAX_BACKUPS = 3;
const BACKUP_INFIX = ".bitwarden-backup-";

// O_NOFOLLOW does not exist on Windows. Automatic mode is never used there.
const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

export interface PathSafetyContext {
  home: string;
  /** Current uid, or null where uids do not exist (Windows). */
  uid: number | null;
}

export interface ExistingFile {
  content: string;
  mode: number;
  hash: string;
}

export class SshAgentSetupBlockedError extends Error {
  constructor(readonly reason: SshAgentSetupBlockedReason) {
    super(reason);
    this.name = "SshAgentSetupBlockedError";
  }
}

export function sha256(content: string | null): string {
  return content == null ? "absent" : createHash("sha256").update(content, "utf8").digest("hex");
}

export function isInside(home: string, target: string): boolean {
  const rel = path.relative(home, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Home-relative display path such as `~/.ssh/config`. */
export function displayPath(home: string, target: string): string {
  return isInside(home, target) ? `~/${path.relative(home, target).split(path.sep).join("/")}` : "";
}

function errorCode(e: unknown): string | undefined {
  return typeof e === "object" && e != null && "code" in e && typeof e.code === "string"
    ? e.code
    : undefined;
}

async function lstatOrNull(p: string) {
  try {
    return await fs.lstat(p);
  } catch (e) {
    if (errorCode(e) === "ENOENT") {
      return null;
    }
    throw e;
  }
}

/**
 * lstat()s the target and every parent up to and including the home directory. Returns the
 * blocked reason, or null when it is safe to read and write. The home directory itself may be a
 * symlink (some systems relocate homes that way); everything below it may not.
 */
export async function checkPathSafety(
  target: string,
  ctx: PathSafetyContext,
  kind: "file" | "dir",
): Promise<SshAgentSetupBlockedReason | null> {
  if (!isInside(ctx.home, target)) {
    return SshAgentSetupBlockedReason.OutsideHome;
  }
  let current = target;
  let isTarget = true;
  for (;;) {
    const isHome = current === ctx.home;
    const stat = isHome ? await fs.stat(current) : await lstatOrNull(current);
    if (stat != null) {
      if (stat.isSymbolicLink()) {
        return SshAgentSetupBlockedReason.Symlink;
      }
      if (ctx.uid != null && stat.uid !== ctx.uid) {
        return SshAgentSetupBlockedReason.Owner;
      }
      if ((stat.mode & 0o022) !== 0) {
        return SshAgentSetupBlockedReason.Permissions;
      }
      const wantFile = isTarget && kind === "file";
      if (wantFile && (!stat.isFile() || stat.nlink > 1)) {
        return SshAgentSetupBlockedReason.NotRegularFile;
      }
      if (!wantFile && !stat.isDirectory()) {
        return SshAgentSetupBlockedReason.NotRegularFile;
      }
      if (wantFile && stat.size > MAX_MANAGED_FILE_BYTES) {
        return SshAgentSetupBlockedReason.TooLarge;
      }
    }
    if (isHome) {
      return null;
    }
    current = path.dirname(current);
    isTarget = false;
  }
}

/** Reads a file without following a symlink at the final component. Null when it is missing. */
export async function readExistingFile(target: string): Promise<ExistingFile | null> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(target, fsConstants.O_RDONLY | O_NOFOLLOW);
  } catch (e) {
    if (errorCode(e) === "ENOENT") {
      return null;
    }
    if (errorCode(e) === "ELOOP") {
      throw new SshAgentSetupBlockedError(SshAgentSetupBlockedReason.Symlink);
    }
    throw e;
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new SshAgentSetupBlockedError(SshAgentSetupBlockedReason.NotRegularFile);
    }
    if (stat.size > MAX_MANAGED_FILE_BYTES) {
      throw new SshAgentSetupBlockedError(SshAgentSetupBlockedReason.TooLarge);
    }
    const content = await handle.readFile({ encoding: "utf8" });
    return { content, mode: stat.mode & 0o7777, hash: sha256(content) };
  } finally {
    await handle.close();
  }
}

async function writeExclusive(target: string, content: string, mode: number): Promise<void> {
  const handle = await fs.open(
    target,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW,
    mode,
  );
  try {
    await handle.writeFile(content, { encoding: "utf8" });
    // The process umask may have narrowed or widened the requested mode.
    await handle.chmod(mode);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(dir: string): Promise<void> {
  try {
    const handle = await fs.open(dir, fsConstants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Directory fsync is best effort; not every platform supports it.
  }
}

/**
 * Writes through a temp file in the same directory (O_EXCL | O_NOFOLLOW), fsyncs and renames it
 * over the target so readers only ever see the old or the new file.
 */
export async function atomicWriteFile(target: string, content: string, mode: number) {
  const dir = path.dirname(target);
  const temp = path.join(dir, `.${path.basename(target)}.bw-tmp-${randomBytes(8).toString("hex")}`);
  try {
    await writeExclusive(temp, content, mode);
    await fs.rename(temp, target);
  } catch (e) {
    await fs.rm(temp, { force: true });
    throw e;
  }
  await syncDirectory(dir);
}

/** Creates any missing directories between home and `dir` with mode 0700. */
export async function ensureDirectory(dir: string, ctx: PathSafetyContext): Promise<void> {
  if (!isInside(ctx.home, dir)) {
    throw new SshAgentSetupBlockedError(SshAgentSetupBlockedReason.OutsideHome);
  }
  const missing: string[] = [];
  let current = dir;
  while (current !== ctx.home && (await lstatOrNull(current)) == null) {
    missing.unshift(current);
    current = path.dirname(current);
  }
  for (const p of missing) {
    await fs.mkdir(p, { mode: 0o700 });
    await fs.chmod(p, 0o700);
  }
}

function backupStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(".", "");
}

/**
 * Saves a 0600 timestamped copy of `content` next to `target` and keeps only the newest
 * MAX_BACKUPS copies for that file.
 */
export async function createBackup(target: string, content: string, now: Date): Promise<void> {
  const dir = path.dirname(target);
  const prefix = `${path.basename(target)}${BACKUP_INFIX}`;
  const stamp = backupStamp(now);
  for (let attempt = 0; ; attempt++) {
    const name = attempt === 0 ? `${prefix}${stamp}` : `${prefix}${stamp}-${attempt}`;
    try {
      await writeExclusive(path.join(dir, name), content, 0o600);
      break;
    } catch (e) {
      if (errorCode(e) !== "EEXIST" || attempt >= 9) {
        throw e;
      }
    }
  }
  const backups = (await fs.readdir(dir)).filter((n) => n.startsWith(prefix)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
    const oldPath = path.join(dir, old);
    const stat = await lstatOrNull(oldPath);
    if (stat?.isFile()) {
      await fs.rm(oldPath, { force: true });
    }
  }
}

/** Removes an app-owned file. Missing files are fine. */
export async function removeFile(target: string): Promise<void> {
  await fs.rm(target, { force: true });
}

/** Removes an app-owned directory only when it is empty. */
export async function removeDirectoryIfEmpty(dir: string): Promise<void> {
  try {
    await fs.rmdir(dir);
  } catch (e) {
    const code = errorCode(e);
    if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") {
      throw e;
    }
  }
}

export function errorClass(e: unknown): string {
  if (e instanceof SshAgentSetupBlockedError) {
    return e.reason;
  }
  return errorCode(e) ?? (e instanceof Error ? e.name : "unknown");
}
