import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";

import { DeviceDisplayData } from "./device-management.component";

export function clearAuthRequestAndResortDevices(
  devices: DeviceDisplayData[],
  pendingAuthRequest: DevicePendingAuthRequest,
): DeviceDisplayData[] {
  return devices
    .map((device) => {
      if (device.pendingAuthRequest?.id === pendingAuthRequest.id) {
        device.pendingAuthRequest = null;
        device.loginStatus = "";
      }
      return device;
    })
    .sort(resortDevices);
}

/**
 * After a device is approved/denied, it will still be at the beginning of the array,
 * so we must resort the array to ensure it is in the correct order.
 *
 * This is a helper function that gets passed to the `Array.sort()` method
 */
export function resortDevices(deviceA: DeviceDisplayData, deviceB: DeviceDisplayData) {
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
