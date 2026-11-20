import { toSdkBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromSdkUserId } from "@bitwarden/common/key-management/utils";
import { BiometricsService } from "@bitwarden/key-management";
import type {
  BiometricsStatus as SdkBiometricsStatus,
  BiometricsUnlock,
  SymmetricKey,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";
import { UnlockMethod, UnlockService } from "@bitwarden/unlock";

// Should not be enabled until after shared unlock is enabled
// This toggles whether the desktop app gets unlock whenever the browser requests an unlock. This
// should only happen after shared unlock has rolled out since otherwise the desktop app
// inadvertently gets unlocked but not locked again.
const SET_USERKEY_UNLOCK = false;

/**
 * SDK driver for biometrics IPC. This is responsible for responding to the browser extension's requests to unlock with biometrics.
 * This replaces the `BiometricMessageHandlerService` entirely.
 *
 * It is registered on the client that receives those requests: main, for the browser extension and
 * the CLI, which reach the desktop app over native messaging.
 */
export class BiometricsUnlockDriver implements BiometricsUnlock {
  constructor(
    private biometricsService: BiometricsService,
    private unlockService: UnlockService,
  ) {}

  async get_biometrics_status(user_id: SdkUserId): Promise<SdkBiometricsStatus> {
    const status = await this.biometricsService.getBiometricsStatusForUser(fromSdkUserId(user_id));
    return toSdkBiometricsStatus(status);
  }

  async unlock_biometrics(user_id: SdkUserId): Promise<SymmetricKey | undefined> {
    const key = await this.biometricsService.unlockWithBiometricsForUser(fromSdkUserId(user_id));
    if (key == null) {
      return undefined;
    }

    if (SET_USERKEY_UNLOCK) {
      await this.unlockService.unlockWithDecryptedUserKey(
        fromSdkUserId(user_id),
        key,
        UnlockMethod.Biometrics,
      );
    }
    return key.toSdk();
  }

  async authenticate_biometrics(): Promise<boolean> {
    return await this.biometricsService.authenticateWithBiometrics();
  }
}
