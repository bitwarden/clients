import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { toSdkBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromSdkUserId } from "@bitwarden/common/key-management/utils";
import { BiometricsStatus } from "@bitwarden/key-management";
import {
  BiometricsStatus as SdkBiometricsStatus,
  BiometricsUnlock,
  SymmetricKey,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { DesktopBiometricsService } from "./desktop.biometrics.service";

/**
 * SDK driver for biometrics IPC, running in the main process. It responds to the browser
 * extension's requests to unlock with biometrics without a renderer round-trip.
 *
 * This is the main-process counterpart to the driver that previously lived in the renderer
 * ({@link ../key-management/biometrics/renderer-biometrics.service.ts}). Registering it on the
 * main-process SDK client collapses the browser -> main -> renderer -> main double hop into
 * browser -> main. It replaces the legacy `BiometricMessageHandlerService`.
 */
export class MainBiometricsUnlockDriver implements BiometricsUnlock {
  constructor(
    private biometricsService: DesktopBiometricsService,
    private accountService: AccountService,
  ) {}

  async get_biometrics_status(user_id: SdkUserId): Promise<SdkBiometricsStatus> {
    const userId = fromSdkUserId(user_id);

    // Only report real biometric status for users that are connected to (logged into) this
    // desktop app. This mirrors the renderer driver's `hasAccessToken$` guard, using the same
    // account-membership check the legacy `BiometricMessageHandlerService` relies on.
    const accounts = await firstValueFrom(this.accountService.accounts$);
    if (accounts[userId] == null) {
      return toSdkBiometricsStatus(BiometricsStatus.NotEnabledInConnectedDesktopApp);
    }

    const status = await this.biometricsService.getBiometricsStatusForUser(userId);
    return toSdkBiometricsStatus(status);
  }

  async unlock_biometrics(user_id: SdkUserId): Promise<SymmetricKey | undefined> {
    const key = await this.biometricsService.unlockWithBiometricsForUser(fromSdkUserId(user_id));
    if (key == null) {
      return undefined;
    }

    return key.toSdk();
  }

  async authenticate_biometrics(): Promise<boolean> {
    return await this.biometricsService.authenticateWithBiometrics();
  }
}
