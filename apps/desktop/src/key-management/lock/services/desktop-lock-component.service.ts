import { inject } from "@angular/core";
import { combineLatest, defer, map, Observable } from "rxjs";

import {
  PinServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService, BiometricsStatus } from "@bitwarden/key-management";
import { LockComponentService, UnlockOptions } from "@bitwarden/key-management-ui";

export class DesktopLockComponentService implements LockComponentService {
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly biometricsService = inject(BiometricsService);
  private readonly pinService = inject(PinServiceAbstraction);

  constructor() {}

  getBiometricsError(error: any): string | null {
    return null;
  }

  getPreviousUrl(): string | null {
    return null;
  }

  async isWindowVisible(): Promise<boolean> {
    return ipc.platform.isWindowVisible();
  }

  getBiometricsUnlockBtnText(): string {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "unlockWithTouchId";
      case DeviceType.WindowsDesktop:
        return "unlockWithWindowsHello";
      case DeviceType.LinuxDesktop:
        return "unlockWithPolkit";
      default:
        throw new Error("Unsupported platform");
    }
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return combineLatest([
      // Note: defer is preferable b/c it delays the execution of the function until the observable is subscribed to
      defer(() => this.biometricsService.getBiometricsStatusForUser(userId)),
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      defer(() => this.pinService.isPinDecryptionAvailable(userId)),
    ]).pipe(
      map(([biometricsStatus, userDecryptionOptions, pinDecryptionAvailable]) => {
        const unlockOpts: UnlockOptions = {
          masterPassword: {
            enabled: userDecryptionOptions?.hasMasterPassword,
          },
          pin: {
            enabled: pinDecryptionAvailable,
          },
          biometrics: {
            enabled: biometricsStatus == BiometricsStatus.Available,
            biometricsStatus: biometricsStatus,
          },
        };

        return unlockOpts;
      }),
    );
  }
}
