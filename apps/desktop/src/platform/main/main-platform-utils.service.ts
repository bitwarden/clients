import { app } from "electron";

import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { isDev, isMacAppStore } from "../../utils";

/**
 * Minimal `PlatformUtilsService` for the Electron main process.
 *
 * The renderer's `ElectronPlatformUtilsService` reads the `ipc.platform.*` preload global (absent in
 * main), and the CLI's `CliPlatformUtilsService` reports CLI device types — neither works here. Only
 * a handful of methods are exercised by the main-process SDK/API/token stack
 * (`getDevice`, `getDeviceString`, `getClientType`, `getApplicationVersion(Number)`, `isDev`,
 * `isSelfHost`, `packageType`, `supportsSecureStorage`); the remaining UI-oriented members are not
 * reachable from that stack and throw if called.
 */
export class MainPlatformUtilsService implements PlatformUtilsService {
  private deviceCache: DeviceType | null = null;

  getDevice(): DeviceType {
    if (this.deviceCache == null) {
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
    return DeviceType[this.getDevice()].toLowerCase().replace("desktop", "");
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
    throw new Error("launchUri is not implemented in the main process PlatformUtilsService.");
  }

  getApplicationVersion(): Promise<string> {
    return Promise.resolve(app.getVersion());
  }

  async getApplicationVersionNumber(): Promise<string> {
    return (await this.getApplicationVersion()).split(RegExp("[+|-]"))[0].trim();
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
    throw new Error("showToast is not implemented in the main process PlatformUtilsService.");
  }

  isDev(): boolean {
    return isDev();
  }

  isSelfHost(): boolean {
    return false;
  }

  copyToClipboard(text: string, options?: any): void {
    throw new Error("copyToClipboard is not implemented in the main process PlatformUtilsService.");
  }

  readFromClipboard(): Promise<string> {
    throw new Error(
      "readFromClipboard is not implemented in the main process PlatformUtilsService.",
    );
  }

  supportsSecureStorage(): boolean {
    // Main persists secure values via the OS credential store (see MainSecureStorageService).
    return true;
  }

  getAutofillKeyboardShortcut(): Promise<string> {
    return Promise.resolve("");
  }

  async packageType(): Promise<string | null> {
    return null;
  }
}
