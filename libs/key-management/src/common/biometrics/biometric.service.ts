/**
 * The biometrics service is used to provide access to the status of and access to biometric functionality on the platforms.
 */
export abstract class BiometricsService {
  /**
   * Check if the platform supports biometric authentication.
   */
  abstract supportsBiometric(): Promise<boolean>;

  /**
   * Checks whether biometric unlock is currently available at the moment (e.g. if the laptop lid is shut, biometric unlock may not be available)
   */
  abstract isBiometricUnlockAvailable(): Promise<boolean>;

  /**
   * Performs biometric authentication
   */
  abstract authenticateBiometric(): Promise<boolean>;
  /**
   * Determine whether biometrics support requires going through a setup process.
   * This is currently only needed on Linux.
   *
   * @returns true if biometrics support requires setup, false if it does not (is already setup, or did not require it in the first place)
   */
  abstract biometricsNeedsSetup(): Promise<boolean>;
  /**
   * Determine whether biometrics support can be automatically setup, or requires user interaction.
   * Auto-setup is prevented by sandboxed environments, such as Snap and Flatpak.
   *
   * @returns true if biometrics support can be automatically setup, false if it requires user interaction.
   */
  abstract biometricsSupportsAutoSetup(): Promise<boolean>;
  /**
   * Start automatic biometric setup, which places the required configuration files / changes the required settings.
   */
  abstract biometricsSetup(): Promise<void>;
}
