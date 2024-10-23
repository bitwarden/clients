export enum BiometricsCommands {
  AuthenticateWithBiometrics = "authenticateWithBiometrics",
  GetBiometricsStatus = "getBiometricsStatus",
  UnlockWithBiometricsForUser = "unlockWithBiometricsForUser",
  GetBiometricsStatusForUser = "getBiometricsStatusForUser",

  // legacy
  Unlock = "biometricUnlock",
  IsAvailable = "biometricUnlockAvailable",
}
