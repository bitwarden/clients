import { app, clipboard } from "electron";

import { ClientType, DeviceType } from "@bitwarden/common/enums";
import {
  ClipboardOptions,
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";

import {
  isAppImage,
  isFlatpak,
  isMacAppStore,
  isSnapStore,
  isWindowsStore,
} from "../../main/platform-utils.main";
import { isDev } from "../../utils";

import { SafeShell } from "./safe-shell.main";

/**
 * The {@link PlatformUtilsService} implementation for the Electron main process.
 *
 * Unlike the renderer's `ElectronPlatformUtilsService`, which reaches the host through the preload
 * `ipc` bridge, this reads Electron/Node directly. It exists so the main process can construct the
 * SDK, unlock, and vault services that previously lived only in the renderer.
 */
export class MainPlatformUtilsService implements PlatformUtilsService {
  private deviceCache: DeviceType = null;

  constructor(private readonly shell: SafeShell) {}

  getDevice(): DeviceType {
    if (!this.deviceCache) {
      switch (process.platform) {
        case "win32":
          this.deviceCache = DeviceType.WindowsDesktop;
          break;
        case "darwin":
          this.deviceCache = DeviceType.MacOsDesktop;
          break;
        case "linux":
        default:
          this.deviceCache = DeviceType.LinuxDesktop;
          break;
      }
    }

    return this.deviceCache;
  }

  getDeviceString(): string {
    const device = DeviceType[this.getDevice()].toLowerCase();
    return device.replace("desktop", "");
  }

  getClientType(): ClientType {
    return ClientType.Desktop;
  }

  isFirefox(): boolean {
    return false;
  }

  isChrome(): boolean {
    return false;
  }

  isEdge(): boolean {
    return false;
  }

  isOpera(): boolean {
    return false;
  }

  isVivaldi(): boolean {
    return false;
  }

  isSafari(): boolean {
    return false;
  }

  isChromium(): boolean {
    return false;
  }

  isMacAppStore(): boolean {
    return isMacAppStore();
  }

  isPopupOpen(): Promise<boolean> {
    return Promise.resolve(false);
  }

  isAnyViewFocused(): Promise<boolean> {
    return Promise.resolve(false);
  }

  launchUri(uri: string, options?: any): void {
    this.shell.openExternal(uri, UrlType.WebUrl);
  }

  getApplicationVersion(): Promise<string> {
    return Promise.resolve(this.getApplicationVersionSync());
  }

  getApplicationVersionSync(): string {
    return app.getVersion();
  }

  async getApplicationVersionNumber(): Promise<string> {
    return (await this.getApplicationVersion()).split(/[+|-]/)[0].trim();
  }

  supportsWebAuthn(win: Window): boolean {
    return false;
  }

  supportsDuo(): boolean {
    return false;
  }

  supportsAutofill(): boolean {
    return false;
  }

  supportsFileDownloads(): boolean {
    return false;
  }

  showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ): void {
    throw new Error("Not implemented.");
  }

  isDev(): boolean {
    return isDev();
  }

  isSelfHost(): boolean {
    return false;
  }

  copyToClipboard(text: string, options?: ClipboardOptions): void {
    clipboard.writeText(text);
  }

  readFromClipboard(): Promise<string> {
    return Promise.resolve(clipboard.readText());
  }

  supportsSecureStorage(): boolean {
    return true;
  }

  getAutofillKeyboardShortcut(): Promise<string> {
    return null;
  }

  async packageType(): Promise<string | null> {
    if (isMacAppStore()) {
      return "MacAppStore";
    } else if (isWindowsStore()) {
      return "WindowsStore";
    } else if (isAppImage()) {
      return "AppImage";
    } else if (isSnapStore()) {
      return "Snap";
    } else if (isFlatpak()) {
      return "Flatpak";
    } else if (this.getDevice() === DeviceType.WindowsDesktop) {
      return "WindowsUnknown";
    } else if (this.getDevice() === DeviceType.MacOsDesktop) {
      return "MacOSUnknown";
    } else if (this.getDevice() === DeviceType.LinuxDesktop) {
      return "LinuxUnknown";
    } else {
      return "DesktopUnknown";
    }
  }
}
