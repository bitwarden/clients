import { BiometricsService } from "@bitwarden/common/key-management/biometrics/biometric.service";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * This service extends the base biometrics service to provide desktop specific functions,
 * specifically for the main process.
 */
export abstract class DesktopBiometricsService extends BiometricsService {
  abstract setBiometricProtectedUnlockKeyForUser(userId: UserId, value: string): Promise<void>;
  abstract deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void>;

  abstract setupBiometrics(): Promise<void>;

  abstract setClientKeyHalfForUser(userId: UserId, value: string): Promise<void>;
}