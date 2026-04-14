import { UserId } from "@bitwarden/common/types/guid";

import { KeyConnectorUnlockData } from "./default-unlock.service";

/**
 * Service for unlocking a user's account with various methods.
 */
export abstract class UnlockService {
  /**
   * Unlocks the user's account using their PIN.
   *
   * @param userId - The user's id
   * @param pin - The user's PIN
   * @throws If the SDK is not available
   * @throws If the PIN is invalid or decryption fails
   */
  abstract unlockWithPin(userId: UserId, pin: string): Promise<void>;

  /**
   * Unlocks the user's account using their master password.
   *
   * @param userId - The user's id
   * @param masterPassword - The user's master password
   * @throws If the SDK is not available
   * @throws If the master password is invalid or decryption fails
   */
  abstract unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void>;

  /**
   * Unlocks the user's account using a biometrics-protected copy of the user-key
   * @param userId - The user's id
   * @throws If the SDK is not available
   * @throws If biometric authentication fails
   */
  abstract unlockWithBiometrics(userId: UserId): Promise<void>;

  /**
   * Unlocks the user's account using a key connector.
   *
   * @param keyConnectorUnlockData - The data required to unlock with the key connector, including the URL and wrapped user key
   * @throws If the SDK is not available
   * @throws If key connector authentication fails
   */
  abstract unlockWithKeyConnector(
    userId: UserId,
    keyConnectorUnlockData: KeyConnectorUnlockData,
  ): Promise<void>;
}
