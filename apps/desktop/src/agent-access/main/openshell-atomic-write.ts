import { randomBytes } from "crypto";
import { promises as fs } from "fs";

export interface AtomicWriteStat {
  mode: number;
  isSymbolicLink(): boolean;
  isFile(): boolean;
}

/** The low-level operations of a safe replace. Injected so a spec can assert the refusals. */
export interface AtomicWriteOps {
  /** Like `fs.lstat`: does not follow a symlink; throws `ENOENT` when there is no such path. */
  lstat(filePath: string): Promise<AtomicWriteStat>;
  /** Creates `filePath` with the exclusive flag (`wx`); throws if it already exists. */
  writeExclusive(filePath: string, content: string, mode: number): Promise<void>;
  chmod(filePath: string, mode: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(filePath: string): Promise<void>;
}

export const nodeAtomicWriteOps: AtomicWriteOps = {
  lstat: (filePath) => fs.lstat(filePath),
  writeExclusive: (filePath, content, mode) =>
    fs.writeFile(filePath, content, { mode, flag: "wx" }),
  chmod: (filePath, mode) => fs.chmod(filePath, mode),
  rename: (from, to) => fs.rename(from, to),
  rm: (filePath) => fs.rm(filePath, { force: true }),
};

/**
 * Replaces `filePath` with `content`: a sibling temp file with a random suffix, created exclusively,
 * given its mode explicitly, then renamed over the target. A target that is a symlink (or anything
 * but a regular file) is refused, never written through. `keepExistingMode` keeps the current
 * file's permissions; otherwise, and for a new file, `mode` is used.
 */
export async function writeFileAtomicNoFollow(
  ops: AtomicWriteOps,
  filePath: string,
  content: string,
  mode: number,
  keepExistingMode: boolean,
): Promise<void> {
  let finalMode = mode;
  try {
    const existing = await ops.lstat(filePath);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new Error("refusing to replace a symlink or a non-regular file");
    }
    if (keepExistingMode) {
      finalMode = existing.mode & 0o777;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
  }

  const temp = `${filePath}.bitwarden-tmp-${randomBytes(8).toString("hex")}`;
  try {
    await ops.writeExclusive(temp, content, finalMode);
    await ops.chmod(temp, finalMode);
    await ops.rename(temp, filePath);
  } catch (e) {
    await ops.rm(temp).catch((): void => undefined);
    throw e;
  }
}
