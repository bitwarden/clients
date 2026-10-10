import {
  LocalDataView as SdkLocalDataView,
  LocalData as SdkLocalData,
} from "@bitwarden/sdk-internal";

// Mirrored in the SDK (bitwarden/sdk-internal: crates/bitwarden-vault/src/cipher/local_data.rs).
// Field changes here must also be made there, along with fromSdkLocalData/toSdkLocalData.
export type LocalData = {
  lastUsedDate?: number;
  lastLaunched?: number;
};

/**
 * Convert the SdkLocalDataView to LocalData
 * @param localData
 */
export function fromSdkLocalData(
  localData: SdkLocalDataView | SdkLocalData | undefined,
): LocalData | undefined {
  if (localData == null) {
    return undefined;
  }
  return {
    lastUsedDate: localData.lastUsedDate ? new Date(localData.lastUsedDate).getTime() : undefined,
    lastLaunched: localData.lastLaunched ? new Date(localData.lastLaunched).getTime() : undefined,
  };
}

/**
 * Convert the LocalData to SdkLocalData
 * @param localData
 */
export function toSdkLocalData(
  localData: LocalData | undefined,
): (SdkLocalDataView & SdkLocalData) | undefined {
  if (localData == null) {
    return undefined;
  }
  return {
    lastUsedDate: localData.lastUsedDate
      ? new Date(localData.lastUsedDate).toISOString()
      : undefined,
    lastLaunched: localData.lastLaunched
      ? new Date(localData.lastLaunched).toISOString()
      : undefined,
  };
}
