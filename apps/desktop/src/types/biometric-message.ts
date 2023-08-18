export enum BiometricStorageAction {
  EnabledForUser = "enabled",
  OsSupported = "osSupported",
  NeedsSetup = "needsSetup",
  Setup = "setup",
}

export type BiometricMessage = {
  action: BiometricStorageAction;
  keySuffix?: string;
  key?: string;
  userId?: string;
};
