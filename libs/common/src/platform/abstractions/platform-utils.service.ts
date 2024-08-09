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
  abstract getDevice(): DeviceType;
  abstract getDeviceString(): string;
  abstract getClientType(): ClientType;
  abstract isFirefox(): boolean;
  abstract isChrome(): boolean;
  abstract isEdge(): boolean;
  abstract isOpera(): boolean;
  abstract isVivaldi(): boolean;
  abstract isSafari(): boolean;
  abstract isMacAppStore(): boolean;
  abstract isViewOpen(): Promise<boolean>;
  abstract launchUri(uri: string, options?: any): void;
  abstract getApplicationVersion(): Promise<string>;
  abstract getApplicationVersionNumber(): Promise<string>;
  abstract supportsWebAuthn(win: Window): boolean;
  abstract supportsDuo(): boolean;
  /**
   * @deprecated use `@bitwarden/components/ToastService.showToast` instead
   *
   * Jira: [CL-213](https://bitwarden.atlassian.net/browse/CL-213)
   */
  abstract showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: ToastOptions,
  ): void;
  abstract isDev(): boolean;
  abstract isSelfHost(): boolean;
  abstract copyToClipboard(text: string, options?: ClipboardOptions): void | boolean;
  abstract readFromClipboard(): Promise<string>;
  abstract supportsBiometric(): Promise<boolean>;
  /**
   * Determine whether biometrics support requires going through a setup process.
   * This is currently only needed on Linux.
   *
   * @returns true if biometrics support requires setup, false if it does not (is already setup, or did not require it in the first place)
   */
  abstract biometricsNeedsSetup: () => Promise<boolean>;
  /**
   * Determine whether biometrics support can be automatically setup, or requires user interaction.
   * Auto-setup is prevented by sandboxed environments, such as Snap and Flatpak.
   *
   * @returns true if biometrics support can be automatically setup, false if it requires user interaction.
   */
  abstract biometricsSupportsAutoSetup(): Promise<boolean>;
  /**
   * Start automatic biometric setup, which places the required configuration files / changes the required settings.
   */
  abstract biometricsSetup: () => Promise<void>;
  abstract authenticateBiometric(): Promise<boolean>;
  abstract supportsSecureStorage(): boolean;
  abstract getAutofillKeyboardShortcut(): Promise<string>;
}
