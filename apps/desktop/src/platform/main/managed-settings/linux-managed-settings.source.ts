import { constants, existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import * as path from "node:path";

import { LogService } from "@bitwarden/logging";

import { ManagedSettingsSource } from "./managed-settings-source";

const CANDIDATES = [
  "/etc/bitwarden/managed-settings.json",
  // A Flatpak sandbox with host-etc:ro exposes the host's /etc at /run/host/etc.
  "/run/host/etc/bitwarden/managed-settings.json",
];

export class LinuxManagedSettingsSource extends ManagedSettingsSource {
  readonly location = CANDIDATES.join(" or ");
  private readonly trustedOwners = LinuxManagedSettingsSource.trustedOwners();

  constructor(private readonly logService: LogService) {
    super();
  }

  private static trustedOwners(): number[] {
    if (!existsSync("/.flatpak-info")) {
      return [0];
    }
    // Bubblewrap maps only the sandbox user's uid, so a host root-owned file reports the kernel
    // overflow uid. Any other unmapped host user reports the same uid, which the breakdown's
    // Security section accepts.
    const overflowUid = Number(readFileSync("/proc/sys/kernel/overflowuid", "utf8").trim());
    return [0, overflowUid].filter((uid) => uid !== process.getuid?.());
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
    // One descriptor is checked and read, so the file cannot be swapped between the two.
    // O_NONBLOCK keeps the open from hanging on a FIFO.
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
      const reason = code === "ELOOP" ? "candidate is a symlink" : `open failed with ${code}`;
      this.logService.warning(`Managed settings: rejected ${candidate}, ${reason}.`);
      return undefined;
    }

    try {
      const stats = await handle.stat();
      let failure = "";
      if (!stats.isFile()) {
        failure = "not a regular file";
      } else if (!this.trustedOwners.includes(stats.uid)) {
        failure = "not owned by root";
      } else if ((stats.mode & 0o022) !== 0) {
        failure = "writable by group or other";
      }
      if (failure !== "") {
        this.logService.warning(`Managed settings: rejected ${candidate}, ${failure}.`);
        return undefined;
      }
      return await handle.readFile({ encoding: "utf8" });
    } finally {
      await handle.close();
    }
  }

  async watch(onChanged: () => void): Promise<void> {
    for (const candidate of CANDIDATES) {
      this.watchDirectory(path.dirname(candidate), path.basename(candidate), onChanged);
    }
  }

  private watchDirectory(dir: string, basename: string, onChanged: () => void): void {
    // Until an administrator creates dir, watch its parent and move the watch once dir appears.
    const present = existsSync(dir);
    const watched = present ? dir : path.dirname(dir);
    let watcher: FSWatcher;
    const rewatch = () => {
      watcher.close();
      this.watchDirectory(dir, basename, onChanged);
      onChanged();
    };

    try {
      // Watch the directory, because a rename-replace leaves a file watch on an unlinked inode.
      // Removing a watched directory emits a "rename" event, not an "error" event.
      watcher = watch(watched, (_event, filename) => {
        if (existsSync(dir) !== present) {
          rewatch();
        } else if (present && (filename === null || filename === basename)) {
          onChanged();
        }
      });
    } catch (e) {
      if (present && (e as NodeJS.ErrnoException).code === "ENOENT") {
        // dir was removed between the existence check and the watch.
        this.watchDirectory(dir, basename, onChanged);
        onChanged();
        return;
      }
      this.logService.info(`Managed settings: not watching ${watched}.`, e);
      return;
    }

    // An FSWatcher is an EventEmitter, so an unhandled "error" event would bring down the main
    // process.
    watcher.on("error", (error) => {
      this.logService.warning(`Managed settings: stopped watching ${watched}, ${error.message}`);
      watcher.close();
    });

    // dir may have been created between the existence check and the watch.
    if (existsSync(dir) !== present) {
      rewatch();
    }
  }
}
