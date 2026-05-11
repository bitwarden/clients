import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
// eslint-disable-next-line no-restricted-imports
import { BiometricsService, BiometricsStatus, KeyService } from "@bitwarden/key-management";
import { UserId, BiometricsUnlock, BiometricsStatus as SdkBiometricsStatus } from "@bitwarden/sdk-internal";
import { UserId as TSUserId } from "@bitwarden/user-core";

function mapBiometricsStatus(status: BiometricsStatus): SdkBiometricsStatus {
  switch (status) {
    case BiometricsStatus.Available:
      return SdkBiometricsStatus.Available;
    case BiometricsStatus.HardwareUnavailable:
      return SdkBiometricsStatus.HardwareUnavailable;
    case BiometricsStatus.NotEnabledLocally:
      return SdkBiometricsStatus.NotEnabled;
    case BiometricsStatus.UnlockNeeded:
      return SdkBiometricsStatus.UnlockNeeded;
    default:
      return SdkBiometricsStatus.NotEnabled;
  }
}

export function createBiometricsDriver(
    biometricsService: BiometricsService,
    keyService: KeyService
): BiometricsUnlock {
  return {
    async get_biometrics_status(user_id: UserId): Promise<SdkBiometricsStatus> {
      const status = await biometricsService.getBiometricsStatusForUser(uuidAsString(user_id) as TSUserId);
      return mapBiometricsStatus(status);
    },
    async unlock_biometrics(user_id: UserId): Promise<void> {
      const key = await biometricsService.unlockWithBiometricsForUser(uuidAsString(user_id) as TSUserId);
      await keyService.setUserKey(key, uuidAsString(user_id) as TSUserId);
    },
    async authenticate_biometrics() {
      return await biometricsService.authenticateWithBiometrics();
    }
  };
}
