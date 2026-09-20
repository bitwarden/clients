import { ListResponse } from "../../models/response/list.response";
import { UserId } from "../../types/guid";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

export abstract class DevicesApiServiceAbstraction {
  abstract getKnownDevice(email: string, deviceIdentifier: string): Promise<boolean>;

  abstract getDeviceByIdentifier(deviceIdentifier: string, userId: UserId): Promise<DeviceResponse>;

  abstract getDevices(userId: UserId): Promise<ListResponse<DeviceResponse>>;

  abstract updateTrustedDeviceKeys(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
    userId: UserId,
  ): Promise<DeviceResponse>;

  abstract updateTrust(
    updateDevicesTrustRequestModel: UpdateDevicesTrustRequest,
    deviceIdentifier: string,
    userId: UserId,
  ): Promise<void>;

  abstract getDeviceKeys(
    deviceIdentifier: string,
    userId: UserId,
  ): Promise<ProtectedDeviceResponse>;

  /**
   * Notifies the server that the device has a device key, but didn't receive any associated decryption keys.
   * Note: For debugging purposes only.
   * @param deviceIdentifier - current device identifier
   * @param userId - the id of the user whose device trust was lost
   */
  abstract postDeviceTrustLoss(deviceIdentifier: string, userId: UserId): Promise<void>;

  /**
   * Deactivates a device
   * @param deviceId - The device ID
   * @param userId - the id of the user whose device is being deactivated
   */
  abstract deactivateDevice(deviceId: string, userId: UserId): Promise<void>;

  /**
   * Removes trust from a list of devices
   * @param deviceIds - The device IDs to be untrusted
   * @param userId - the id of the user whose devices are being untrusted
   */
  abstract untrustDevices(deviceIds: string[], userId: UserId): Promise<void>;
}
