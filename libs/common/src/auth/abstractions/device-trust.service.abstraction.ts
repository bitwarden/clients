// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { EncString } from "../../platform/models/domain/enc-string";
import { UserId } from "../../types/guid";
import { DeviceKey, UserKey } from "../../types/key";

import { DeviceResponse } from "./devices/responses/device.response";

export abstract class DeviceTrustServiceAbstraction {
  supportsDeviceTrust$: Observable<boolean>;
  /**
   * @description Retrieves the users choice to trust the device which can only happen after decryption
   * Note: this value should only be used once and then reset
   */
  getShouldTrustDevice: (userId: UserId) => Promise<boolean | null>;
  setShouldTrustDevice: (userId: UserId, value: boolean) => Promise<void>;

  trustDeviceIfRequired: (userId: UserId) => Promise<void>;

  trustDevice: (userId: UserId) => Promise<DeviceResponse>;

  /** Retrieves the device key if it exists from state or secure storage if supported for the active user. */
  getDeviceKey: (userId: UserId) => Promise<DeviceKey | null>;
  decryptUserKeyWithDeviceKey: (
    userId: UserId,
    encryptedDevicePrivateKey: EncString,
    encryptedUserKey: EncString,
    deviceKey: DeviceKey,
  ) => Promise<UserKey | null>;
  rotateDevicesTrust: (
    userId: UserId,
    newUserKey: UserKey,
    masterPasswordHash: string,
  ) => Promise<void>;
  /**
   * Notifies the server that the device has a device key, but didn't receive any associated decryption keys.
   * Note: For debugging purposes only.
   */
  recordDeviceTrustLoss: () => Promise<void>;
}
