import { inject } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { UserId } from "@bitwarden/common/types/guid";
import { LockComponentService, UnlockOptions } from "@bitwarden/key-management/angular";

export class WebLockComponentService implements LockComponentService {
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);

  constructor() {}

  getBiometricsError(error: any): string | null {
    throw new Error(
      "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
    );
  }

  getPreviousUrl(): string | null {
    return null;
  }

  async isWindowVisible(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  getBiometricsUnlockBtnText(): string {
    throw new Error(
      "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
    );
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return this.userDecryptionOptionsService.userDecryptionOptionsById$(userId).pipe(
      map((userDecryptionOptions: UserDecryptionOptions) => {
        const unlockOpts: UnlockOptions = {
          masterPassword: {
            enabled: userDecryptionOptions.hasMasterPassword,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            disableReason: null,
          },
        };
        return unlockOpts;
      }),
    );
  }
}
