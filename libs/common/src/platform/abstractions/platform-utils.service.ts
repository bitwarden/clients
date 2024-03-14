import { ClientType, DeviceType } from "../../enums";

interface ToastOptions {
  timeout?: number;
}

export type ClipboardOptions = {
  allowHistory?: boolean;
  clearing?: boolean;
  clearMs?: number;
  window?: Window;
};

export abstract class PlatformUtilsService {
  getDevice: () => DeviceType;
  getDeviceString: () => string;
  getClientType: () => ClientType;
  isFirefox: () => boolean;
  isChrome: () => boolean;
  isEdge: () => boolean;
  isOpera: () => boolean;
  isVivaldi: () => boolean;
  isSafari: () => boolean;
  isMacAppStore: () => boolean;
  isViewOpen: () => Promise<boolean>;
  launchUri: (uri: string, options?: any) => void;
  getApplicationVersion: () => Promise<string>;
  getApplicationVersionNumber: () => Promise<string>;
  supportsWebAuthn: (win: Window) => boolean;
  supportsDuo: () => boolean;
  /**
   * @deprecated use `@bitwarden/components/ToastService.showToast` instead
   *
   * Jira: [CL-213](https://bitwarden.atlassian.net/browse/CL-213)
   */
  showToast: (
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: ToastOptions,
  ) => void;
  isDev: () => boolean;
  isSelfHost: () => boolean;
  copyToClipboard: (text: string, options?: ClipboardOptions) => void | boolean;
  readFromClipboard: () => Promise<string>;
  supportsBiometric: () => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  supportsSecureStorage: () => boolean;
  getAutofillKeyboardShortcut: () => Promise<string>;
}
