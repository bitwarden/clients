import { DeviceResponse } from "../../abstractions/devices/responses/device.response";
import { EncString } from "../../platform/models/domain/enc-string";
import { DeviceKey, UserKey } from "../../platform/models/domain/symmetric-crypto-key";

export abstract class DeviceTrustCryptoServiceAbstraction {
  /**
   * @description Retrieves the users choice to trust the device which can only happen after decryption
   * Note: this value should only be used once and then reset
   */
  getShouldTrustDevice: () => Promise<boolean | null>;
  setShouldTrustDevice: (value: boolean) => Promise<void>;

  trustDeviceIfRequired: () => Promise<void>;

  trustDevice: () => Promise<DeviceResponse>;
  getDeviceKey: () => Promise<DeviceKey>;
  decryptUserKeyWithDeviceKey: (
    encryptedDevicePrivateKey: EncString,
    encryptedUserKey: EncString,
    deviceKey?: DeviceKey
  ) => Promise<UserKey | null>;
  rotateDevicesTrust: (newUserKey: UserKey, masterPasswordHash: string) => Promise<void>;

  supportsDeviceTrust: () => Promise<boolean>;
}
