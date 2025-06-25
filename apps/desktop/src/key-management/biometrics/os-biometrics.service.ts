import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

export interface OsBiometricService {
  supportsBiometrics(): Promise<boolean>;
  /**
   * Check whether support for biometric unlock requires setup. This can be automatic or manual.
   *
   * @returns true if biometrics support requires setup, false if it does not (is already setup, or did not require it in the first place)
   */
  needsSetup(): Promise<boolean>;
  /**
   * Check whether biometrics can be automatically setup, or requires user interaction.
   *
   * @returns true if biometrics support can be automatically setup, false if it requires user interaction.
   */
  canAutoSetup(): Promise<boolean>;
  /**
   * Starts automatic biometric setup, which places the required configuration files / changes the required settings.
   */
  runSetup(): Promise<void>;
  authenticateBiometric(): Promise<boolean>;
  getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null>;
  setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void>;
  deleteBiometricKey(userId: UserId): Promise<void>;
  getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus>;
}
