// Temporary mappers for biometrics status until the SDK is fully integrated.
// In the fully migrated version, the typescript biometrics status is removed entirely.

// eslint-disable-next-line no-restricted-imports
import { BiometricsStatus } from "@bitwarden/key-management";
import { BiometricsStatus as SdkBiometricsStatus } from "@bitwarden/sdk-internal";

export function toSdkBiometricsStatus(status: BiometricsStatus): SdkBiometricsStatus {
  switch (status) {
    case BiometricsStatus.Available:
      return SdkBiometricsStatus.Available;
    case BiometricsStatus.HardwareUnavailable:
      return SdkBiometricsStatus.HardwareUnavailable;
    case BiometricsStatus.NotEnabledLocally:
      return SdkBiometricsStatus.NotEnabled;
    case BiometricsStatus.UnlockNeeded:
      return SdkBiometricsStatus.UnlockNeeded;
    default:
      return SdkBiometricsStatus.NotEnabled;
  }
}

export function toTsBiometricsStatus(status: SdkBiometricsStatus): BiometricsStatus {
  switch (status) {
    case SdkBiometricsStatus.Available:
      return BiometricsStatus.Available;
    case SdkBiometricsStatus.HardwareUnavailable:
      return BiometricsStatus.HardwareUnavailable;
    case SdkBiometricsStatus.NotEnabled:
      return BiometricsStatus.NotEnabledLocally;
    case SdkBiometricsStatus.UnlockNeeded:
      return BiometricsStatus.UnlockNeeded;
    default:
      return BiometricsStatus.NotEnabledLocally;
  }
}
