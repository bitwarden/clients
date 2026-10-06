// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum BiometricsStatus {
  /** For the biometrics interface, this means that biometric unlock is available and can be used. Querying for the user specifically, this means that biometric can be used for to unlock this user */
  Available,
  /** Biometrics cannot be used, because the userkey needs to first be unlocked by the user's password, because unlock needs some volatile data that is not available on app-start */
  UnlockNeeded,
  /** Biometric hardware is not available (i.e laptop folded shut, sensor unplugged) */
  HardwareUnavailable,
  /** Only relevant for linux, this means that polkit policies need to be set up and that can happen automatically */
  AutoSetupNeeded,
  /** Only relevant for linux, this means that polkit policies need to be set up but that needs to be done manually */
  ManualSetupNeeded,
  /** Biometrics is not implemented for this platform (i.e web) */
  PlatformUnsupported,
  /** Browser extension cannot connect to the desktop app to use biometrics */
  DesktopDisconnected,
  /** Biometrics is not enabled in the desktop app/extension (current app) */
  NotEnabledLocally,
  /** Only on browser extension; Biometrics is not enabled in the desktop app */
  NotEnabledInConnectedDesktopApp,
  /** Browser extension does not have the permission to talk to the desktop app */
  NativeMessagingPermissionMissing,
}
