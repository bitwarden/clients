import { ListResponse } from "../../models/response/list.response";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

export abstract class DevicesApiServiceAbstraction {
  abstract getKnownDevice(email: string, deviceIdentifier: string): Promise<boolean>;

  abstract getDeviceByIdentifier(deviceIdentifier: string): Promise<DeviceResponse>;

  abstract getDevices(): Promise<ListResponse<DeviceResponse>>;

  abstract updateTrustedDeviceKeys(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
  ): Promise<DeviceResponse>;

  abstract updateTrust(
    updateDevicesTrustRequestModel: UpdateDevicesTrustRequest,
    deviceIdentifier: string,
  ): Promise<void>;

  abstract getDeviceKeys(deviceIdentifier: string): Promise<ProtectedDeviceResponse>;

  /**
   * Notifies the server that the device has a device key, but didn't receive any associated decryption keys.
   * Note: For debugging purposes only.
   * @param deviceIdentifier - current device identifier
   */
  abstract postDeviceTrustLoss(deviceIdentifier: string): Promise<void>;

  /**
   * Deactivates a device
   * @param deviceId - The device ID
   */
  abstract deactivateDevice(deviceId: string): Promise<void>;

  /**
   * Removes trust from a list of devices
   * @param deviceIds - The device IDs to be untrusted
   */
  abstract untrustDevices(deviceIds: string[]): Promise<void>;
}
