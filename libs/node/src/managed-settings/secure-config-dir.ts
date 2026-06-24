import { lstatSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";

interface Logger {
  warning(message: string): void;
}

const POSIX_WRITABLE_BY_OTHERS = 0o022;

/**
 * Reads every `*.json` policy file in `dir` that passes a permission check enforcing the
 * admin-only-source trust model, shallow-merges them (sorted filename order, later wins),
 * and returns the merged object. A missing directory yields `{}` silently; an insecure or
 * malformed file is logged and skipped (never used, never thrown).
 */
export function readSecureManagedConfigDir(
  dir: string,
  platform: NodeJS.Platform,
  logger: Logger,
): Record<string, unknown> {
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".json"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warning(`Managed config directory ${dir} could not be read: ${String(e)}`);
    }
    return {};
  }

  const merged: Record<string, unknown> = {};
  for (const name of entries.sort()) {
    const filePath = join(dir, name);
    const check = isSecure(filePath, platform);
    if (!check.secure) {
      logger.warning(`Ignoring managed config file ${filePath}: ${check.reason}.`);
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(merged, parsed);
      } else {
        logger.warning(`Ignoring managed config file ${filePath}: not a JSON object.`);
      }
    } catch (e) {
      logger.warning(`Ignoring managed config file ${filePath}: ${String(e)}.`);
    }
  }
  return merged;
}

function isSecure(
  filePath: string,
  platform: NodeJS.Platform,
): { secure: boolean; reason?: string } {
  if (platform === "win32") {
    // Option A: %ProgramData%'s default ACL is the trust anchor; verify a regular file only.
    try {
      if (!lstatSync(filePath).isFile()) {
        return { secure: false, reason: "is not a regular file" };
      }
    } catch (e) {
      return { secure: false, reason: String(e) };
    }
    return { secure: true };
  }

  // POSIX: file and parent dir owned by root (uid 0), not group/world-writable, not a symlink.
  try {
    if (lstatSync(filePath).isSymbolicLink()) {
      return { secure: false, reason: "is a symlink" };
    }
    // lstat above confirmed this is not a symlink, so statSync sees the same file (no redirection).
    const file = statSync(filePath);
    if (file.uid !== 0) {
      return { secure: false, reason: `is not owned by root (uid ${file.uid})` };
    }
    if ((file.mode & POSIX_WRITABLE_BY_OTHERS) !== 0) {
      return { secure: false, reason: "is group- or world-writable" };
    }
    // Every ancestor directory up to root must be root-owned and not writable by others,
    // otherwise an unprivileged user could replace the file and forge a managed setting.
    let dir = dirname(filePath);
    for (;;) {
      const dirStat = statSync(dir);
      if (dirStat.uid !== 0 || (dirStat.mode & POSIX_WRITABLE_BY_OTHERS) !== 0) {
        return {
          secure: false,
          reason: `ancestor directory ${dir} is not root-owned or is writable by others`,
        };
      }
      const parent = dirname(dir);
      if (parent === dir) {
        break; // reached the filesystem root
      }
      dir = parent;
    }
    return { secure: true };
  } catch (e) {
    return { secure: false, reason: String(e) };
  }
}
