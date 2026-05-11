import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
// eslint-disable-next-line no-restricted-imports
import { BiometricsService, BiometricsStatus, KeyService } from "@bitwarden/key-management";
import {
  UserId,
  BiometricsUnlock,
  BiometricsStatus as SdkBiometricsStatus,
} from "@bitwarden/sdk-internal";
import { UserId as TSUserId } from "@bitwarden/user-core";

function toSdkBiometricsStatus(status: BiometricsStatus): SdkBiometricsStatus {
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

function fromSdkUserId(userId: UserId): TSUserId {
  return uuidAsString(userId) as TSUserId;
}

export function createBiometricsDriver(
  biometricsService: BiometricsService,
  keyService: KeyService,
): BiometricsUnlock {
  return {
    async get_biometrics_status(user_id: UserId): Promise<SdkBiometricsStatus> {
      const status = await biometricsService.getBiometricsStatusForUser(fromSdkUserId(user_id));
      return toSdkBiometricsStatus(status);
    },
    async unlock_biometrics(user_id: UserId): Promise<void> {
      const key = await biometricsService.unlockWithBiometricsForUser(fromSdkUserId(user_id));
      if (key != null) {
        await keyService.setUserKey(key, fromSdkUserId(user_id));
      }
    },
    async authenticate_biometrics() {
      return await biometricsService.authenticateWithBiometrics();
    },
  };
}
