import { constants } from "node:fs";
import * as fs from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import * as path from "node:path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { ManagedSettingsSource } from "./managed-settings-source";

const CANDIDATES = [
  "/etc/bitwarden/managed-settings.json",
  // A Flatpak sandbox exposes the host's /etc at /run/host/etc rather than at /etc.
  "/run/host/etc/bitwarden/managed-settings.json",
];

export class LinuxManagedSettingsSource extends ManagedSettingsSource {
  constructor(private readonly logService: LogService) {
    super();
  }

  async read(): Promise<string | undefined> {
    for (const candidate of CANDIDATES) {
      const contents = await this.readCandidate(candidate);
      if (contents !== undefined) {
        return contents;
      }
    }
    return undefined;
  }

  private async readCandidate(candidate: string): Promise<string | undefined> {
    // Linux offers no access-control guarantee equivalent to the HKEY_LOCAL_MACHINE\SOFTWARE\Policies
    // ACL or a root-owned macOS managed preference domain, so this source supplies the check the
    // platform does not. The descriptor, not the path, is the unit of checking: opening once with
    // O_NOFOLLOW and running both stat and readFile through that single handle guarantees the file
    // that gets checked is necessarily the file that gets read. Checking a path and then reopening it
    // would leave a window to swap the file, and that window is reachable in exactly the case this
    // check exists for, an administrator who created /etc/bitwarden writable by a non-root user.
    // O_NONBLOCK is a no-op on a regular file and keeps the open from hanging on a FIFO planted in
    // that same directory.
    let handle: FileHandle;
    try {
      handle = await open(
        candidate,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return undefined;
      }
      if (code === "ELOOP") {
        this.logService.warning(`[ManagedSettings] Rejected ${candidate}: candidate is a symlink.`);
        return undefined;
      }
      // Any other open failure, EACCES above all, means this candidate is unusable rather than
      // that acquisition failed. Falling through lets the Flatpak candidate still be tried.
      this.logService.warning(`[ManagedSettings] Rejected ${candidate}: open failed with ${code}.`);
      return undefined;
    }

    try {
      const stats = await handle.stat();
      if (!stats.isFile()) {
        this.logService.warning(`[ManagedSettings] Rejected ${candidate}: not a regular file.`);
        return undefined;
      }
      if (stats.uid !== 0) {
        this.logService.warning(`[ManagedSettings] Rejected ${candidate}: not owned by root.`);
        return undefined;
      }
      if ((stats.mode & 0o022) !== 0) {
        this.logService.warning(
          `[ManagedSettings] Rejected ${candidate}: writable by group or other.`,
        );
        return undefined;
      }
      return await handle.readFile({ encoding: "utf8" });
    } finally {
      await handle.close();
    }
  }

  async watch(onChanged: () => void): Promise<void> {
    for (const candidate of CANDIDATES) {
      this.watchCandidate(candidate, onChanged);
    }
  }

  private watchCandidate(candidate: string, onChanged: () => void): void {
    const dir = path.dirname(candidate);
    const basename = path.basename(candidate);
    try {
      // The directory is watched rather than the file. An administrator who replaces the file by
      // rename would leave a file watch pointing at an unlinked inode.
      const watcher = fs.watch(dir, (_event, filename) => {
        if (filename === null || filename === basename) {
          onChanged();
        }
      });
      // An FSWatcher is an EventEmitter, so an unhandled "error" event throws. The directory going
      // away under a running watcher is an ordinary administrator action, not a reason to bring
      // down the main process.
      watcher.on("error", (error) => {
        this.logService.warning(`[ManagedSettings] Stopped watching ${dir}: ${error.message}`);
        watcher.close();
      });
    } catch {
      // /etc/bitwarden, or its Flatpak host-mount equivalent, may legitimately not exist yet.
      this.logService.info(`[ManagedSettings] Not watching ${dir}.`);
    }
  }
}
