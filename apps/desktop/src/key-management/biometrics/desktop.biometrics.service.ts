import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService } from "@bitwarden/key-management";

/**
 * This service extends the base biometrics service to provide desktop specific functions,
 * specifically for the main process.
 */
export abstract class DesktopBiometricsService extends BiometricsService {
  abstract setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void>;
  abstract deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void>;
  abstract setupBiometrics(): Promise<void>;
  abstract enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void>;
  abstract hasPersistentKey(userId: UserId): Promise<boolean>;
  /* Enables the v2 biometrics re-write. This will stay enabled until the application is restarted. */
  abstract enableWindowsV2Biometrics(): Promise<void>;
  abstract isWindowsV2BiometricsEnabled(): Promise<boolean>;
  /* Enables the v2 biometrics re-write. This will stay enabled until the application is restarted. */
  abstract enableLinuxV2Biometrics(): Promise<void>;
  abstract isLinuxV2BiometricsEnabled(): Promise<boolean>;
}
