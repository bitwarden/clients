import {
  LocalDataView as SdkLocalDataView,
  LocalData as SdkLocalData,
} from "@bitwarden/sdk-internal";

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
  const lastUsedDate = localData.lastUsedDate ? new Date(localData.lastUsedDate) : undefined;
  const lastLaunched = localData.lastLaunched ? new Date(localData.lastLaunched) : undefined;
  return {
    lastUsedDate:
      lastUsedDate && !isNaN(lastUsedDate.getTime()) ? lastUsedDate.getTime() : undefined,
    lastLaunched:
      lastLaunched && !isNaN(lastLaunched.getTime()) ? lastLaunched.getTime() : undefined,
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
  const lastUsedDate = localData.lastUsedDate ? new Date(localData.lastUsedDate) : undefined;
  const lastLaunched = localData.lastLaunched ? new Date(localData.lastLaunched) : undefined;
  return {
    lastUsedDate:
      lastUsedDate && !isNaN(lastUsedDate.getTime()) ? lastUsedDate.toISOString() : undefined,
    lastLaunched:
      lastLaunched && !isNaN(lastLaunched.getTime()) ? lastLaunched.toISOString() : undefined,
  };
}
