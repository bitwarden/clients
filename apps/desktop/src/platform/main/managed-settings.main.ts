import { FSWatcher, watch } from "fs";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { readSecureManagedConfigDir } from "@bitwarden/node/managed-settings/secure-config-dir";

import { WindowMain } from "../../main/window.main";

const LINUX_POLICY_DIR = "/etc/bitwarden/policies";

export class ManagedSettingsMain {
  private watcher?: FSWatcher;
  private debounce?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  init(): void {
    ipcMain.handle("managedSettings", () => this.read());
    if (this.platform === "linux") {
      this.watchLinux();
    }
    // Windows registry-change and macOS poll watchers are wired in Tasks 5 and 6.
  }

  /** Read the OS source into a raw config bag. Never throws. */
  read(): Record<string, unknown> {
    try {
      if (this.platform === "linux") {
        return readSecureManagedConfigDir(LINUX_POLICY_DIR, this.platform, this.logService);
      }
      return {};
    } catch (e) {
      this.logService.error(`Failed to read managed settings: ${String(e)}`);
      return {};
    }
  }

  /** Push the current bag to the renderer. */
  private notifyRenderer(): void {
    this.windowMain.win?.webContents.send("managedSettingsUpdated", this.read());
  }

  private watchLinux(): void {
    try {
      this.watcher = watch(LINUX_POLICY_DIR, { persistent: false }, () => {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => this.notifyRenderer(), 200);
      });
      this.watcher.on("error", (e) =>
        this.logService.warning(`Managed config watch error: ${String(e)}`),
      );
    } catch (e) {
      // Directory may not exist; absence is normal and not an error.
      this.logService.info(`Not watching ${LINUX_POLICY_DIR}: ${String(e)}`);
    }
  }
}
