import { Observable } from "rxjs";

import { EncString } from "../../platform/models/domain/enc-string";
import { UserId } from "../../types/guid";
import { DeviceKey, UserKey } from "../../types/key";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";

export abstract class DeviceTrustCryptoServiceAbstraction {
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
}
