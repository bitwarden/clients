import { combineLatest, defer, switchMap, map, Observable } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";
import {
  LockComponentService,
  UnlockOptions,
  WebAuthnPrfUnlockService,
} from "@bitwarden/key-management-ui";

import { BiometricErrors, BiometricErrorTypes } from "../../../models/biometricErrors";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";

export class ExtensionLockComponentService implements LockComponentService {
  constructor(
    private readonly userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private readonly biometricsService: BiometricsService,
    private readonly pinService: PinServiceAbstraction,
    private readonly biometricStateService: BiometricStateService,
    private readonly routerService: BrowserRouterService,
    private readonly webAuthnPrfUnlockService: WebAuthnPrfUnlockService,
  ) {}

  getPreviousUrl(): string | null {
    return this.routerService.getPreviousUrl() ?? null;
  }

  getBiometricsError(error: any): string | null {
    const biometricsError = BiometricErrors[error?.message as BiometricErrorTypes];

    if (!biometricsError) {
      return null;
    }

    return biometricsError.description;
  }

  async popOutBrowserExtension(): Promise<void> {
    if (!BrowserPopupUtils.inPopout(global.window) && !BrowserPopupUtils.inSidebar(global.window)) {
      await BrowserPopupUtils.openCurrentPagePopout(global.window);
    }
  }

  closeBrowserExtensionPopout(): void {
    if (BrowserPopupUtils.inPopout(global.window)) {
      BrowserApi.closePopup(global.window);
    }
  }

  async isWindowVisible(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  getBiometricsUnlockBtnText(): string {
    return "unlockWithBiometrics";
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return combineLatest([
      // Check biometricUnlockEnabled$ first to avoid background native messaging & IPC calls when biometrics is disabled.
      this.biometricStateService
        .biometricUnlockEnabled$(userId)
        .pipe(
          switchMap(async (enabled) =>
            enabled
              ? await this.biometricsService.getBiometricsStatusForUser(userId)
              : BiometricsStatus.NotEnabledLocally,
          ),
        ),
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      defer(() => this.pinService.isPinDecryptionAvailable(userId)),
      defer(async () => {
        const available = await this.webAuthnPrfUnlockService.isPrfUnlockAvailable(userId);
        return { available };
      }),
    ]).pipe(
      map(([biometricsStatus, userDecryptionOptions, pinDecryptionAvailable, prfUnlockInfo]) => {
        const unlockOpts: UnlockOptions = {
          masterPassword: {
            enabled: userDecryptionOptions?.hasMasterPassword,
          },
          pin: {
            enabled: pinDecryptionAvailable,
          },
          biometrics: {
            enabled: biometricsStatus === BiometricsStatus.Available,
            biometricsStatus: biometricsStatus,
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
