// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import {
  ClipboardOptions,
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { SafariApp } from "../../../browser/safariApp";
import { BrowserApi } from "../../browser/browser-api";
import { OffscreenDocumentService } from "../../offscreen-document/abstractions/offscreen-document";
import BrowserClipboardService from "../browser-clipboard.service";

export abstract class BrowserPlatformUtilsService implements PlatformUtilsService {
  private static deviceCache: DeviceType = null;

  constructor(
    private clipboardWriteCallback: (clipboardValue: string, clearMs: number) => void,
    private globalContext: Window | ServiceWorkerGlobalScope,
    private offscreenDocumentService: OffscreenDocumentService,
  ) {}

  static getDevice(globalContext: Window | ServiceWorkerGlobalScope): DeviceType {
    if (this.deviceCache) {
      return this.deviceCache;
    }

    if (BrowserPlatformUtilsService.isFirefox()) {
      this.deviceCache = DeviceType.FirefoxExtension;
    } else if (BrowserPlatformUtilsService.isOpera(globalContext)) {
      this.deviceCache = DeviceType.OperaExtension;
    } else if (BrowserPlatformUtilsService.isEdge()) {
      this.deviceCache = DeviceType.EdgeExtension;
    } else if (BrowserPlatformUtilsService.isVivaldi()) {
      this.deviceCache = DeviceType.VivaldiExtension;
    } else if (BrowserPlatformUtilsService.isChrome(globalContext)) {
      this.deviceCache = DeviceType.ChromeExtension;
    } else if (BrowserPlatformUtilsService.isSafari(globalContext)) {
      this.deviceCache = DeviceType.SafariExtension;
    }

    return this.deviceCache;
  }

  getDevice(): DeviceType {
    return BrowserPlatformUtilsService.getDevice(this.globalContext);
  }

  getDeviceString(): string {
    const device = DeviceType[this.getDevice()].toLowerCase();
    return device.replace("extension", "");
  }

  getClientType(): ClientType {
    return ClientType.Browser;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  static isFirefox(): boolean {
    return (
      navigator.userAgent.indexOf(" Firefox/") !== -1 ||
      navigator.userAgent.indexOf(" Gecko/") !== -1
    );
  }

  isFirefox(): boolean {
    return this.getDevice() === DeviceType.FirefoxExtension;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  private static isChrome(globalContext: Window | ServiceWorkerGlobalScope): boolean {
    return globalContext.chrome && navigator.userAgent.indexOf(" Chrome/") !== -1;
  }

  isChrome(): boolean {
    return this.getDevice() === DeviceType.ChromeExtension;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  private static isEdge(): boolean {
    return navigator.userAgent.indexOf(" Edg/") !== -1;
  }

  isEdge(): boolean {
    return this.getDevice() === DeviceType.EdgeExtension;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  private static isOpera(globalContext: Window | ServiceWorkerGlobalScope): boolean {
    return (
      !!globalContext.opr?.addons ||
      !!globalContext.opera ||
      navigator.userAgent.indexOf(" OPR/") >= 0
    );
  }

  isOpera(): boolean {
    return this.getDevice() === DeviceType.OperaExtension;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  private static isVivaldi(): boolean {
    return navigator.userAgent.indexOf(" Vivaldi/") !== -1;
  }

  isVivaldi(): boolean {
    return this.getDevice() === DeviceType.VivaldiExtension;
  }

  /**
   * @deprecated Do not call this directly, use getDevice() instead
   */
  static isSafari(globalContext: Window | ServiceWorkerGlobalScope): boolean {
    // Opera masquerades as Safari, so make sure we're not there first
    return (
      !BrowserPlatformUtilsService.isOpera(globalContext) &&
      navigator.userAgent.indexOf(" Safari/") !== -1
    );
  }

  private static safariVersion(): string {
    return navigator.userAgent.match("Version/([0-9.]*)")?.[1];
  }

  /**
   * Safari previous to version 16.1 had a bug which caused artifacts on hover in large extension popups.
   * https://bugs.webkit.org/show_bug.cgi?id=218704
   */
  static shouldApplySafariHeightFix(globalContext: Window | ServiceWorkerGlobalScope): boolean {
    if (BrowserPlatformUtilsService.getDevice(globalContext) !== DeviceType.SafariExtension) {
      return false;
    }

    const version = BrowserPlatformUtilsService.safariVersion();
    const parts = version?.split(".")?.map((v) => Number(v));
    return parts?.[0] < 16 || (parts?.[0] === 16 && parts?.[1] === 0);
  }

  isSafari(): boolean {
    return this.getDevice() === DeviceType.SafariExtension;
  }

  isIE(): boolean {
    return false;
  }

  isMacAppStore(): boolean {
    return false;
  }

  /**
   * Identifies if the vault popup is currently open. This is done by sending a
   * message to the popup and waiting for a response. If a response is received,
   * the view is open.
   */
  async isViewOpen(): Promise<boolean> {
    if (this.isSafari()) {
      // Query views on safari since chrome.runtime.sendMessage does not timeout and will hang.
      return BrowserApi.isPopupOpen();
    }

    return new Promise<boolean>((resolve, reject) => {
      chrome.runtime.sendMessage({ command: "checkVaultPopupHeartbeat" }, (response) => {
        if (chrome.runtime.lastError != null) {
          // This error means that nothing was there to listen to the message,
          // meaning the view is not open.
          if (
            chrome.runtime.lastError.message ===
            "Could not establish connection. Receiving end does not exist."
          ) {
            resolve(false);
            return;
          }

          // All unhandled errors still reject
          reject(chrome.runtime.lastError);
          return;
        }

        resolve(Boolean(response));
      });
    });
  }

  lockTimeout(): number {
    return null;
  }

  launchUri(uri: string, options?: any): void {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.createNewTab(uri, options && options.extensionPage === true);
  }

  getApplicationVersion(): Promise<string> {
    const manifest = chrome.runtime.getManifest();
    return Promise.resolve(manifest.version_name ?? manifest.version);
  }

  getApplicationVersionNumber(): Promise<string> {
    const manifest = chrome.runtime.getManifest();
    return Promise.resolve(manifest.version.split(RegExp("[+|-]"))[0].trim());
  }

  supportsWebAuthn(win: Window): boolean {
    return typeof PublicKeyCredential !== "undefined";
  }

  supportsDuo(): boolean {
    return true;
  }

  abstract showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ): void;

  isDev(): boolean {
    return process.env.ENV === "development";
  }

  isSelfHost(): boolean {
    return false;
  }

  /**
   * Copies the passed text to the clipboard. For Safari, this will use
   * the native messaging API to send the text to the Bitwarden app. If
   * the extension is using manifest v3, the offscreen document API will
   * be used to copy the text to the clipboard. Otherwise, the browser's
   * clipboard API will be used.
   *
   * @param text - The text to copy to the clipboard.
   * @param options - Options for the clipboard operation.
   */
  copyToClipboard(text: string, options?: ClipboardOptions): void {
    const windowContext = options?.window || (this.globalContext as Window);
    const clearing = Boolean(options?.clearing);
    const clearMs: number = options?.clearMs || null;
    const handleClipboardWriteCallback = () => {
      if (!clearing && this.clipboardWriteCallback != null) {
        this.clipboardWriteCallback(text, clearMs);
      }
    };

    if (this.isSafari()) {
      void SafariApp.sendMessageToApp("copyToClipboard", text).then(handleClipboardWriteCallback);

      return;
    }

    if (this.isChrome() && text === "") {
      text = "\u0000";
    }

    if (BrowserApi.isManifestVersion(3) && this.offscreenDocumentService.offscreenApiSupported()) {
      void this.triggerOffscreenCopyToClipboard(text).then(handleClipboardWriteCallback);

      return;
    }

    void BrowserClipboardService.copy(windowContext, text).then(handleClipboardWriteCallback);
  }

  /**
   * Reads the text from the clipboard. For Safari, this will use the
   * native messaging API to request the text from the Bitwarden app. If
   * the extension is using manifest v3, the offscreen document API will
   * be used to read the text from the clipboard. Otherwise, the browser's
   * clipboard API will be used.
   *
   * @param options - Options for the clipboard operation.
   */
  async readFromClipboard(options?: ClipboardOptions): Promise<string> {
    const windowContext = options?.window || (this.globalContext as Window);

    if (this.isSafari()) {
      return await SafariApp.sendMessageToApp("readFromClipboard");
    }

    if (BrowserApi.isManifestVersion(3) && this.offscreenDocumentService.offscreenApiSupported()) {
      return await this.triggerOffscreenReadFromClipboard();
    }

    return await BrowserClipboardService.read(windowContext);
  }

  supportsSecureStorage(): boolean {
    return false;
  }

  async getAutofillKeyboardShortcut(): Promise<string> {
    let autofillCommand: string;
    // You can not change the command in Safari or obtain it programmatically
    if (this.isSafari()) {
      autofillCommand = "Cmd+Shift+L";
    } else if (this.isFirefox()) {
      autofillCommand = (await browser.commands.getAll()).find(
        (c) => c.name === ExtensionCommand.AutofillLogin,
      ).shortcut;
      // Firefox is returning Ctrl instead of Cmd for the modifier key on macOS if
      // the command is the default one set on installation.
      if (
        (await browser.runtime.getPlatformInfo()).os === "mac" &&
        autofillCommand === "Ctrl+Shift+L"
      ) {
        autofillCommand = "Cmd+Shift+L";
      }
    } else {
      await new Promise((resolve) =>
        chrome.commands.getAll((c) =>
          resolve(
            (autofillCommand = c.find((c) => c.name === ExtensionCommand.AutofillLogin).shortcut),
          ),
        ),
      );
    }
    return autofillCommand;
  }

  /**
   * Triggers the offscreen document API to copy the text to the clipboard.
   */
  private async triggerOffscreenCopyToClipboard(text: string) {
    await this.offscreenDocumentService.withDocument(
      [chrome.offscreen.Reason.CLIPBOARD],
      "Write text to the clipboard.",
      async () => {
        await BrowserApi.sendMessageWithResponse("offscreenCopyToClipboard", { text });
      },
    );
  }

  /**
   * Triggers the offscreen document API to read the text from the clipboard.
   */
  private async triggerOffscreenReadFromClipboard() {
    const response = await this.offscreenDocumentService.withDocument(
      [chrome.offscreen.Reason.CLIPBOARD],
      "Read text from the clipboard.",
      async () => {
        return await BrowserApi.sendMessageWithResponse("offscreenReadFromClipboard");
      },
    );
    if (typeof response === "string") {
      return response;
    }

    return "";
  }
}
