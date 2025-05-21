export interface OsBiometricService {
  osSupportsBiometric(): Promise<boolean>;
  /**
   * Check whether support for biometric unlock requires setup. This can be automatic or manual.
   *
   * @returns true if biometrics support requires setup, false if it does not (is already setup, or did not require it in the first place)
   */
  osBiometricsNeedsSetup: () => Promise<boolean>;
  /**
   * Check whether biometrics can be automatically setup, or requires user interaction.
   *
   * @returns true if biometrics support can be automatically setup, false if it requires user interaction.
   */
  osBiometricsCanAutoSetup: () => Promise<boolean>;
  /**
   * Starts automatic biometric setup, which places the required configuration files / changes the required settings.
   */
  osBiometricsSetup: () => Promise<void>;
  authenticateBiometric(): Promise<boolean>;
  getBiometricKey(
    service: string,
    key: string,
    clientKeyHalfB64: string | undefined,
  ): Promise<string | null>;
  setBiometricKey(
    service: string,
    key: string,
    value: string,
    clientKeyHalfB64: string | undefined,
  ): Promise<void>;
  deleteBiometricKey(service: string, key: string): Promise<void>;
}
