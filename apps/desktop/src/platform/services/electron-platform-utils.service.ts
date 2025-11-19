// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  ClipboardOptions,
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ClipboardWriteMessage } from "../types/clipboard";

export const ELECTRON_SUPPORTS_SECURE_STORAGE = true;

export class ElectronPlatformUtilsService implements PlatformUtilsService {
  constructor(
    protected i18nService: I18nService,
    private messagingService: MessagingService,
  ) {}

  getDevice(): DeviceType {
    return ipc.platform.deviceType;
  }

  getDeviceString(): string {
    const device = DeviceType[this.getDevice()].toLowerCase();
    return device.replace("desktop", "");
  }

  getClientType() {
    return ClientType.Desktop;
  }

  isFirefox(): boolean {
    return false;
  }

  isChrome(): boolean {
    return true;
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
    return true;
  }

  isMacAppStore(): boolean {
    return ipc.platform.isMacAppStore;
  }

  isPopupOpen(): Promise<boolean> {
    return Promise.resolve(false);
  }

  launchUri(uri: string, options?: any): void {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ipc.platform.launchUri(uri);
  }

  getApplicationVersion(): Promise<string> {
    return ipc.platform.versions.app();
  }

  async getApplicationVersionNumber(): Promise<string> {
    return (await this.getApplicationVersion()).split(/[+|-]/)[0].trim();
  }

  // Linux and Mac are missing a ui to enter a pin, so this works for two-factor security keys, when always-uv is not active
  supportsWebAuthn(win: Window): boolean {
    return true;
  }

  supportsDuo(): boolean {
    return true;
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
    this.messagingService.send("showToast", {
      text: text,
      title: title,
      type: type,
      options: options,
    });
  }

  isDev(): boolean {
    return ipc.platform.isDev;
  }

  isSelfHost(): boolean {
    return false;
  }

  copyToClipboard(text: string, options?: ClipboardOptions): void {
    const clearing = options?.clearing === true;
    const clearMs = options?.clearMs ?? null;

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ipc.platform.clipboard.write({
      text: text,
      password: (options?.allowHistory ?? false) === false, // default to false
    } satisfies ClipboardWriteMessage);

    if (!clearing) {
      this.messagingService.send("copiedToClipboard", {
        clipboardValue: text,
        clearMs: clearMs,
        clearing: clearing,
      });
    }
  }

  readFromClipboard(): Promise<string> {
    return ipc.platform.clipboard.read();
  }

  supportsSecureStorage(): boolean {
    return ELECTRON_SUPPORTS_SECURE_STORAGE;
  }

  getAutofillKeyboardShortcut(): Promise<string> {
    return null;
  }

  async userAgentPart(): Promise<string> {
    let packageType = "Unsandboxed";
    if (ipc.platform.isMacAppStore) {
      packageType = "MacAppStore";
    } else if (ipc.platform.isWindowsStore) {
      packageType = "WindowsStore";
    } else if (ipc.platform.isAppImage) {
      packageType = "AppImage";
    } else if (ipc.platform.isSnapStore) {
      packageType = "Snap";
    } else if (ipc.platform.isFlatpak) {
      packageType = "Flatpak";
    }
    return `Bitwarden-Desktop/${await this.getApplicationVersion()} (${packageType})`;
  }
}
