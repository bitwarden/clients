import { combineLatest, defer, filter, switchMap, map, Observable } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
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

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";
import { SHARED_UNLOCK_EXTERNAL } from "../../shared-unlock-messages";

export class ExtensionLockComponentService implements LockComponentService {
  constructor(
    private readonly userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private readonly biometricsService: BiometricsService,
    private readonly pinService: PinServiceAbstraction,
    private readonly biometricStateService: BiometricStateService,
    private readonly routerService: BrowserRouterService,
    private readonly webAuthnPrfUnlockService: WebAuthnPrfUnlockService,
    private readonly sharedUnlockSettingsService: SharedUnlockSettingsService,
    private readonly configService: ConfigService,
    private readonly messageListener: MessageListener,
  ) {}

  getPreviousUrl(): string | null {
    return this.routerService.getPreviousUrl() ?? null;
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

  getExternalUnlock$(userId: UserId): Observable<void> {
    return this.messageListener.messages$(SHARED_UNLOCK_EXTERNAL).pipe(
      filter((msg) => msg.userId === userId),
      map((): void => undefined),
    );
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return combineLatest([
      combineLatest([
        this.configService.getFeatureFlag$(FeatureFlag.SharedUnlockPart2),
        this.sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$(userId),
        this.sharedUnlockSettingsService.unlockSharingDisabled$(userId),
        // Check biometricUnlockEnabled$ first to avoid background native messaging & IPC calls when biometrics is disabled.
        this.biometricStateService.biometricUnlockEnabled$(userId),
      ]).pipe(
        switchMap(
          async ([
            sharedUnlockFeatureFlag,
            allowSharingWithDesktop,
            unlockSharingDisabled,
            biometricUnlockEnabled,
          ]) =>
            biometricUnlockEnabled ||
            (sharedUnlockFeatureFlag && allowSharingWithDesktop && !unlockSharingDisabled)
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
