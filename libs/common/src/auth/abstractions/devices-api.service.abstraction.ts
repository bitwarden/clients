// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ListResponse } from "../../models/response/list.response";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

export abstract class DevicesApiServiceAbstraction {
  getKnownDevice: (email: string, deviceIdentifier: string) => Promise<boolean>;

  getDeviceByIdentifier: (deviceIdentifier: string) => Promise<DeviceResponse>;

  getDevices: () => Promise<ListResponse<DeviceResponse>>;

  updateTrustedDeviceKeys: (
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
  ) => Promise<DeviceResponse>;

  updateTrust: (
    updateDevicesTrustRequestModel: UpdateDevicesTrustRequest,
    deviceIdentifier: string,
  ) => Promise<void>;

  getDeviceKeys: (deviceIdentifier: string) => Promise<ProtectedDeviceResponse>;

  /**
   * Notifies the server that the device has a device key, but didn't receive any associated decryption keys.
   * Note: For debugging purposes only.
   * @param deviceIdentifier - current device identifier
   */
  postDeviceTrustLoss: (deviceIdentifier: string) => Promise<void>;

  /**
   * Deactivates a device
   * @param deviceId - The device ID
   */
  deactivateDevice: (deviceId: string) => Promise<void>;

  /**
   * Removes trust from a list of devices
   * @param deviceIds - The device IDs to be untrusted
   */
  untrustDevices: (deviceIds: string[]) => Promise<void>;
}
