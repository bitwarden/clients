import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

import { BiometricsStatus } from "./biometrics-status";

/**
 * The biometrics service is used to provide access to the status of and access to biometric functionality on the platforms.
 */
export abstract class BiometricsService {
  supportsBiometric() {
    throw new Error("Method not implemented.");
  }
  /**
   * Performs a biometric prompt, without unlocking any keys
   * @returns true if the biometric prompt was successful, false otherwise
   */
  abstract authenticateWithBiometrics(): Promise<boolean>;

  /**
   * Gets the status of biometrics for the platform system states.
   * @returns the status of biometrics
   */
  abstract getBiometricsStatus(): Promise<BiometricsStatus>;

  /**
   * Retrieves a userkey for the provided user, as present in the biometrics system.
   * THIS NEEDS TO BE VERIFIED FOR RECENCY AND VALIDITY
   * @param userId the user to unlock
   * @returns the user key
   */
  abstract unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null>;

  /**
   * Gets the status of biometrics for a current user. This includes system states (hardware unavailable) but also user specific states (needs unlock with master-password).
   * @param userId the user to check the biometrics status for
   * @returns the status of biometrics for the user
   */
  abstract getBiometricsStatusForUser(userId: UserId): Promise<BiometricsStatus>;

  abstract getShouldAutopromptNow(): Promise<boolean>;
  abstract setShouldAutopromptNow(value: boolean): Promise<void>;
  abstract canEnableBiometricUnlock(): Promise<boolean>;
}
