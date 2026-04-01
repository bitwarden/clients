import { inject } from "@angular/core";
import { combineLatest, defer, map, Observable } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";
import {
  LockComponentService,
  UnlockOptions,
  WebAuthnPrfUnlockService,
} from "@bitwarden/key-management-ui";

export class WebLockComponentService implements LockComponentService {
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly webAuthnPrfUnlockService = inject(WebAuthnPrfUnlockService);

  constructor() {}

  getBiometricsError(error: any): string | null {
    throw new Error(
      "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
    );
  }

  getPreviousUrl(): string | null {
    return null;
  }

  popOutBrowserExtension(): Promise<void> {
    throw new Error("Method not supported on this platform.");
  }

  closeBrowserExtensionPopout(): void {
    throw new Error("Method not supported on this platform.");
  }

  async isWindowVisible(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  getBiometricsUnlockBtnText(): string {
    throw new Error(
      "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
    );
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions | null> {
    return combineLatest([
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      defer(async () => {
        const available = await this.webAuthnPrfUnlockService.isPrfUnlockAvailable(userId);
        return { available };
      }),
    ]).pipe(
      map(([userDecryptionOptions, prfUnlockInfo]) => {
        const unlockOpts: UnlockOptions = {
          masterPassword: {
            enabled: userDecryptionOptions.hasMasterPassword,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
          prf: {
            enabled: prfUnlockInfo.available,
          },
        };
        return unlockOpts;
      }),
    );
  }
}
