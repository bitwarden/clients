import { DeviceDisplayData } from "./device-management.component";

/**
 * After a device is approved/denied, it will still be at the beginning of the array,
 * so we must resort the array to ensure it is in the correct order.
 *
 * This is a helper function that gets passed to the `Array.sort()` method
 */
export function deviceReSort(deviceA: DeviceDisplayData, deviceB: DeviceDisplayData) {
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

  // Then sort the rest by display name (alphabetically)
  if (deviceA.displayName < deviceB.displayName) {
    return -1;
  }
  if (deviceA.displayName > deviceB.displayName) {
    return 1;
  }

  // Default
  return 0;
}
