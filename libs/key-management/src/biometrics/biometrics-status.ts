export enum BiometricsStatus {
  Available,
  UnlockNeeded,
  HardwareUnavailable,
  AutoSetupNeeded, // linux only; polkit setup needed
  ManualSetupNeeded, // linux only; polkit setup needed
  PlatformUnsupported,
  DesktopDisconnected,
  NotEnabledLocally,
  NotEnabledInConnectedDesktopApp,
}
