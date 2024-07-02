export enum BiometricAction {
  EnabledForUser = "enabled",
  OsSupported = "osSupported",
  Authenticate = "authenticate",
  NeedsSetup = "needsSetup",
  Setup = "setup",
  CanAutoSetup = "canAutoSetup",
}

export type BiometricMessage = {
  action: BiometricAction;
  keySuffix?: string;
  key?: string;
  userId?: string;
};
