// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum BiometricsCommands {
  /** Perform biometric authentication for the system's user. Does not require setup, and does not return cryptographic material, only yes or no. */
  AuthenticateWithBiometrics = "authenticateWithBiometrics",
  /** Get biometric status of the system, and can be used before biometrics is set up. Only returns data about the biometrics system, not about availability of cryptographic material */
  GetBiometricsStatus = "getBiometricsStatus",
  /** Perform biometric authentication for the system's user for the given bitwarden account's credentials. This returns cryptographic material that can be used to unlock the vault. */
  UnlockWithBiometricsForUser = "unlockWithBiometricsForUser",
  /** Get biometric status for a specific user account. This includes both information about availability of cryptographic material (is the user configured for biometric unlock? is a masterpassword unlock needed? But also information about the biometric system's availability in a single status) */
  GetBiometricsStatusForUser = "getBiometricsStatusForUser",

  /** Checks whether the biometric unlock can be enabled. */
  CanEnableBiometricUnlock = "canEnableBiometricUnlock",
}
