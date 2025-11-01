// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as child_process from "child_process";

import open from "open";

import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class CliPlatformUtilsService implements PlatformUtilsService {
  clientType: ClientType;

  private deviceCache: DeviceType = null;

  constructor(
    clientType: ClientType,
    private packageJson: any,
  ) {
    this.clientType = clientType;
  }

  getDevice(): DeviceType {
    if (!this.deviceCache) {
      switch (process.platform) {
        case "win32":
          this.deviceCache = DeviceType.WindowsCLI;
          break;
        case "darwin":
          this.deviceCache = DeviceType.MacOsCLI;
          break;
        case "linux":
        default:
          this.deviceCache = DeviceType.LinuxCLI;
          break;
      }
    }

    return this.deviceCache;
  }

  getDeviceString(): string {
    const device = DeviceType[this.getDevice()].toLowerCase();
    return device.replace("cli", "");
  }

  getClientType() {
    return this.clientType;
  }

  isFirefox() {
    return false;
  }

  isChrome() {
    return false;
  }

  isEdge() {
    return false;
  }

  isOpera() {
    return false;
  }

  isVivaldi() {
    return false;
  }

  isSafari() {
    return false;
  }

  isChromium(): boolean {
    return false;
  }

  isMacAppStore() {
    return false;
  }

  isPopupOpen() {
    return Promise.resolve(false);
  }

  launchUri(uri: string, options?: any): void {
    if (process.platform === "linux") {
      child_process.spawnSync("xdg-open", [uri]);
    } else {
      // eslint-disable-next-line no-console
      open(uri).catch(console.error);
    }
  }

  getApplicationVersion(): Promise<string> {
    return Promise.resolve(this.packageJson.version);
  }

  async getApplicationVersionNumber(): Promise<string> {
    return (await this.getApplicationVersion()).split(RegExp("[+|-]"))[0].trim();
  }

  getApplicationVersionSync(): string {
    return this.packageJson.version;
  }

  supportsWebAuthn(win: Window) {
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
    return process.env.BWCLI_ENV === "development";
  }

  isSelfHost(): boolean {
    return false;
  }

  copyToClipboard(text: string, options?: any): void {
    throw new Error("Not implemented.");
  }

  readFromClipboard(options?: any): Promise<string> {
    throw new Error("Not implemented.");
  }

  supportsSecureStorage(): boolean {
    return false;
  }

  getAutofillKeyboardShortcut(): Promise<string> {
    return null;
  }
}
