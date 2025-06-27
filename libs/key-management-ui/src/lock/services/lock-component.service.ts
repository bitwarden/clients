import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

// ex: type UnlockOptionValue = "masterPassword" | "pin" | "biometrics"
export type UnlockOptionValue = (typeof UnlockOption)[keyof typeof UnlockOption];

export const UnlockOption = Object.freeze({
  MasterPassword: "masterPassword",
  Pin: "pin",
  Biometrics: "biometrics",
}) satisfies { [Prop in keyof UnlockOptions as Capitalize<Prop>]: Prop };

export type UnlockOptions = {
  masterPassword: {
    enabled: boolean;
  };
  pin: {
    enabled: boolean;
  };
  biometrics: {
    enabled: boolean;
    biometricsStatus: BiometricsStatus;
  };
};

/**
 * The LockComponentService is a service which allows the single libs/auth LockComponent to delegate all
 * client specific functionality to client specific services implementations of LockComponentService.
 */
export abstract class LockComponentService {
  // Extension
  abstract getBiometricsError(error: any): string | null;
  abstract getPreviousUrl(): string | null;
  /**
   * Opens the current page in a popout window if not already in a popout or the sidebar.
   * If already in a popout or sidebar, does nothing.
   * @throws Error if execution context is not a browser extension.
   */
  abstract popOutBrowserExtension(): Promise<void>;
  /**
   * Closes the current popout window if in a popout.
   * If not in a popout, does nothing.
   * @throws Error if execution context is not a browser extension.
   */
  abstract closeBrowserExtensionPopout(): void;

  // Desktop only
  abstract isWindowVisible(): Promise<boolean>;
  abstract getBiometricsUnlockBtnText(): string;

  // Multi client
  abstract getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions | null>;
}
