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

  // Desktop only
  abstract isWindowVisible(): Promise<boolean>;
  abstract getBiometricsUnlockBtnText(): string;

  // Multi client
  abstract getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions | null>;
}
