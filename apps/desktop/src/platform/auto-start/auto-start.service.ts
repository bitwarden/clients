import * as fs from "fs";
import * as path from "path";

import { app } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autostart } from "@bitwarden/desktop-napi";

import { isFlatpak, isSnapStore } from "../../utils";
import { DesktopSettingsService } from "../services/desktop-settings.service";

import { AutoStartService, AutoStartStatus } from "./auto-start.service.abstraction";

/**
 * Default implementation of the AutoStartService for managing desktop auto-start behavior.
 *
 * The implementation varies by platform:
 * - **Linux (Flatpak)**: Uses the XDG autostart portal via desktop-napi
 * - **Linux (Standard)**: Creates a .desktop file in ~/.config/autostart/
 * - **Linux (Snap)**: Auto-start is managed by snap configuration (not handled here)
 * - **macOS/Windows**: Uses Electron's app.setLoginItemSettings() API
 */
export class DefaultAutoStartService implements AutoStartService {
  constructor(
    private logService: LogService,
    private desktopSettingsService: DesktopSettingsService,
  ) {}

  async enable(): Promise<void> {
    if (process.platform === "linux") {
      if (isFlatpak()) {
        // Use the XDG autostart portal for Flatpak
        await autostart.setAutostart(true, []).catch((e) => {
          this.logService.error("Failed to enable autostart via portal:", e);
        });
      } else if (!isSnapStore()) {
        // For standard Linux, create a .desktop file in autostart directory
        // Snap auto-start is configured via electron-builder snap configuration
        this.createDesktopFile();
      }
    } else {
      // macOS and Windows use Electron's native API
      app.setLoginItemSettings({ openAtLogin: true });
    }
  }

  async disable(): Promise<void> {
    if (process.platform === "linux") {
      if (isFlatpak()) {
        // Use the XDG autostart portal for Flatpak
        await autostart.setAutostart(false, []).catch((e) => {
          this.logService.error("Failed to disable autostart via portal:", e);
        });
      } else if (!isSnapStore()) {
        // For standard Linux, remove the .desktop file
        // Snap auto-start is configured via electron-builder snap configuration
        this.removeDesktopFile();
      }
    } else {
      // macOS and Windows use Electron's native API
      app.setLoginItemSettings({ openAtLogin: false });
    }
  }

  async isEnabled(): Promise<AutoStartStatus> {
    if (process.platform === "linux") {
      if (isFlatpak() || isSnapStore()) {
        // For Flatpak/Snap, we can't reliably check the state from within the app.
        // The autostart portal (Flatpak) and snap configuration don't provide query APIs.
        return AutoStartStatus.Unknown;
      } else {
        // For standard Linux, check if the desktop file exists.
        return fs.existsSync(this.getLinuxDesktopFilePath())
          ? AutoStartStatus.Enabled
          : AutoStartStatus.Disabled;
      }
    } else {
      // macOS and Windows use Electron's native API.
      const loginSettings = app.getLoginItemSettings();
      return loginSettings.openAtLogin ? AutoStartStatus.Enabled : AutoStartStatus.Disabled;
    }
  }

  /**
   * Creates the .desktop file for Linux autostart.
   */
  private createDesktopFile(): void {
    const desktopFileContent = `[Desktop Entry]
Type=Application
Version=${app.getVersion()}
Name=Bitwarden
Comment=Bitwarden startup script
Exec=${app.getPath("exe")}
StartupNotify=false
Terminal=false`;

    const filePath = this.getLinuxDesktopFilePath();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, desktopFileContent);
  }

  /**
   * Removes the .desktop file for Linux autostart.
   */
  private removeDesktopFile(): void {
    const filePath = this.getLinuxDesktopFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Gets the path to the Linux autostart .desktop file.
   */
  private getLinuxDesktopFilePath(): string {
    return path.join(app.getPath("home"), ".config", "autostart", "bitwarden.desktop");
  }
}
