import { FSWatcher, watch } from "fs";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings/managed-settings.service";
import { managed_settings, windows_registry } from "@bitwarden/desktop-napi";
import { readSecureManagedConfigDir } from "@bitwarden/node/managed-settings/secure-config-dir";

import { WindowMain } from "../../main/window.main";

const LINUX_POLICY_DIR = "/etc/bitwarden/policies";

export class ManagedSettingsMain {
  private watcher?: FSWatcher;
  private debounce?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private lastBag?: string;

  constructor(
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
    private readonly managedSettings: ManagedSettingsService,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  // The handle is populated asynchronously after startup begins, so post-startup reads (locale for
  // native menus) are forced, but a very-early read such as app.disableHardwareAcceleration() in
  // main.ts resolves before the profile arrives, so forcing hardware acceleration is deferred to a
  // later slice.
  init(): void {
    ipcMain.handle("managedSettings", () => this.read());
    void this.pushToService();
    if (this.platform === "linux") {
      this.watchLinux();
    }
    if (this.platform === "win32") {
      void managed_settings.watchRegistry("SOFTWARE\\Policies\\Bitwarden", () => {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => void this.notifyIfChanged(), 200);
      });
    }
    if (this.platform === "darwin") {
      // The managed-prefs change notification is unreliable; poll and diff at low frequency.
      this.poll = setInterval(() => void this.notifyIfChanged(), 60_000);
    }
  }

  private async pushToService(): Promise<void> {
    this.managedSettings.pushExplicit(await this.read());
  }

  /** Read the OS source into a raw config bag. Never throws. */
  async read(): Promise<Record<string, unknown>> {
    try {
      if (this.platform === "linux") {
        return readSecureManagedConfigDir(LINUX_POLICY_DIR, this.platform, this.logService);
      }
      if (this.platform === "win32") {
        return await windows_registry.readValues("HKLM", "SOFTWARE\\Policies\\Bitwarden");
      }
      if (this.platform === "darwin") {
        return await managed_settings.readPreferences("com.bitwarden.desktop");
      }
      return {};
    } catch (e) {
      this.logService.error(`Failed to read managed settings: ${String(e)}`);
      return {};
    }
  }

  /** Re-reads and notifies the renderer only when the bag has changed. */
  private async notifyIfChanged(): Promise<void> {
    const bag = await this.read();
    const serialized = JSON.stringify(bag);
    if (serialized !== this.lastBag) {
      this.lastBag = serialized;
      this.managedSettings.pushExplicit(bag);
      this.windowMain.win?.webContents.send("managedSettingsUpdated", bag);
    }
  }

  private watchLinux(): void {
    try {
      this.watcher = watch(LINUX_POLICY_DIR, { persistent: false }, () => {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => void this.notifyIfChanged(), 200);
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
