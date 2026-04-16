import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { SortDirection, SortFn } from "@bitwarden/components";

import { DeviceDisplayData } from "../device-management.component";

// Chronological sort for when a user explicitly clicks the column header.
// Null activity dates are treated as epoch 0 (very old), so they naturally sort to the bottom
// when sorting newest-first (desc) and to the top when sorting oldest-first (asc).
export const recentlyActiveSortFn: SortFn = (
  a: DeviceDisplayData,
  b: DeviceDisplayData,
  direction: SortDirection = "asc",
): number => {
  // Pin the current session to the top only when sorting newest-first (desc), so it stays
  // visible at the top. The framework multiplies our result by -1 when direction is "desc",
  // so we return +1 here (not -1). After the framework negates it: +1 * -1 = -1, which puts
  // the current device (a) first.
  if (direction === "desc") {
    if (a.isCurrentDevice) {
      return 1;
    }
    if (b.isCurrentDevice) {
      return -1;
    }
  }

  // If both devices have a lastActivityDate, sort by it.
  // Otherwise, treat null as epoch 0 so they sort to the bottom.
  const aTime = a.lastActivityDate?.getTime() ?? 0;
  const bTime = b.lastActivityDate?.getTime() ?? 0;

  // The framework (table-data-source.ts) handles direction by multiplying by directionModifier,
  // so we intentionally do not apply direction here to avoid a double-reversal.
  return aTime - bTime;
};

export function clearAuthRequestAndSortDevices(
  devices: DeviceDisplayData[],
  pendingAuthRequest: DevicePendingAuthRequest,
  // TODO: PM-34091 - Remove the sortFn parameter; always call sortDevicesWithActivity (will be renamed to sortDevices) directly.
  sortFn: (a: DeviceDisplayData, b: DeviceDisplayData) => number = sortDevices,
): DeviceDisplayData[] {
  // TODO: Tech debt - .map() mutates the original device objects in-place instead of returning new
  // object references. Callers holding refs to the original items will see silent side effects, and
  // any child component receiving an individual device as @Input() will not detect the change under
  // OnPush change detection. Fix by spreading the matched device into a new object:
  // `return { ...device, pendingAuthRequest: null, loginStatus: "" }`
  return devices
    .map((device) => {
      if (device.pendingAuthRequest?.id === pendingAuthRequest.id) {
        device.pendingAuthRequest = null;
        device.loginStatus = "";
      }
      return device;
    })
    .sort(sortFn);
}

/**
 * After a device is approved/denied, it will still be at the beginning of the array,
 * so we must sort the array to ensure it is in the correct order.
 *
 * This is a helper function that gets passed to the `Array.sort()` method
 *
 * TODO: PM-34091 - Delete this function entirely; sortDevicesWithActivity replaces it.
 */
export function sortDevices(deviceA: DeviceDisplayData, deviceB: DeviceDisplayData) {
  // Devices with a pending auth request should be first
  if (deviceA.pendingAuthRequest) {
    return -1;
  }
  if (deviceB.pendingAuthRequest) {
    return 1;
  }

  // Next is the current device
  if (deviceA.isCurrentDevice) {
    return -1;
  }
  if (deviceB.isCurrentDevice) {
    return 1;
  }

  // Then sort the rest by creation date (newest to oldest)
  if (deviceA.creationDate > deviceB.creationDate) {
    return -1;
  }
  if (deviceA.creationDate < deviceB.creationDate) {
    return 1;
  }

  // Default
  return 0;
}

/**
 * Sort order when the DevicesLastActivityDate feature flag is enabled:
 * 1. Current session
 * 2. Pending login requests
 * 3. Most recently active (lastActivityDate, newest first)
 * 4. First login date (fallback when lastActivityDate is null)
 * TODO: PM-34091 - rename this to just sortDevices.
 */
export function sortDevicesWithActivity(deviceA: DeviceDisplayData, deviceB: DeviceDisplayData) {
  // Current device is always first
  if (deviceA.isCurrentDevice) {
    return -1;
  }
  if (deviceB.isCurrentDevice) {
    return 1;
  }

  // Devices with a pending auth request come next
  if (deviceA.pendingAuthRequest) {
    return -1;
  }
  if (deviceB.pendingAuthRequest) {
    return 1;
  }

  // Sort by lastActivityDate (newest first); devices without it sort after those with it
  if (deviceA.lastActivityDate && deviceB.lastActivityDate) {
    return deviceB.lastActivityDate.getTime() - deviceA.lastActivityDate.getTime();
  }
  if (deviceA.lastActivityDate) {
    return -1;
  }
  if (deviceB.lastActivityDate) {
    return 1;
  }

  // Fall back to first login date (newest first)
  return deviceB.firstLogin.getTime() - deviceA.firstLogin.getTime();
}
