import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService } from "@bitwarden/key-management";

/**
 * This service extends the base biometrics service to provide desktop specific functions,
 * specifically for the main process.
 */
export abstract class DesktopBiometricsService extends BiometricsService {
  abstract deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void>;
  abstract setupBiometrics(): Promise<void>;
}
