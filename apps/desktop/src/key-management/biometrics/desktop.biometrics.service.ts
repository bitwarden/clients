import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService } from "@bitwarden/key-management";

/**
 * This service extends the base biometrics service to provide desktop specific functions,
 * specifically for the main process.
 */
export abstract class DesktopBiometricsService extends BiometricsService {
  abstract deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void>;
  abstract setupBiometrics(): Promise<void>;
  /* Enables the v2 biometrics re-write. This will stay enabled until the application is restarted. */
  abstract enableLinuxV2Biometrics(): Promise<void>;
  abstract isLinuxV2BiometricsEnabled(): Promise<boolean>;
}
