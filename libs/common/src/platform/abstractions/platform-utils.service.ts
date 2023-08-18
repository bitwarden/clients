import { ClientType, DeviceType } from "../../enums";

interface ToastOptions {
  timeout?: number;
}

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
  showToast: (
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: ToastOptions
  ) => void;
  isDev: () => boolean;
  isSelfHost: () => boolean;
  copyToClipboard: (text: string, options?: any) => void | boolean;
  readFromClipboard: (options?: any) => Promise<string>;
  supportsBiometric: () => Promise<boolean>;
  biometricsNeedsSetup: () => Promise<boolean>;
  biometricsSetup: () => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  supportsSecureStorage: () => boolean;
  getAutofillKeyboardShortcut: () => Promise<string>;
}
