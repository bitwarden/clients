import { Observable } from "rxjs";

import { OtherDeviceKeysUpdateRequest } from "@bitwarden/common/auth/models/request/update-devices-trust.request";

import { DeviceResponse } from "../../../auth/abstractions/devices/responses/device.response";
import { UserId } from "../../../types/guid";
import { DeviceKey, UserKey } from "../../../types/key";
import { EncString } from "../../crypto/models/enc-string";

export abstract class DeviceTrustServiceAbstraction {
  /**
   * @deprecated - use supportsDeviceTrustByUserId instead as active user state is being deprecated
   * by Platform
   * @description Checks if the device trust feature is supported for the active user.
   */
  abstract supportsDeviceTrust$: Observable<boolean>;

  /**
   * Emits when a device has been trusted. This emission is specifically for the purpose of notifying
   * the consuming component to display a toast informing the user the device has been trusted.
   */
  abstract deviceTrusted$: Observable<void>;

  /**
   * @description Checks if the device trust feature is supported for the given user.
   */
  abstract supportsDeviceTrustByUserId$(userId: UserId): Observable<boolean>;

  /**
   * @description Retrieves the users choice to trust the device which can only happen after decryption
   * Note: this value should only be used once and then reset
   */
  abstract getShouldTrustDevice(userId: UserId): Promise<boolean | null>;
  abstract setShouldTrustDevice(userId: UserId, value: boolean): Promise<void>;

  abstract trustDeviceIfRequired(userId: UserId): Promise<void>;

  abstract trustDevice(userId: UserId): Promise<DeviceResponse>;

  /** Retrieves the device key if it exists from state or secure storage if supported for the active user. */
  abstract getDeviceKey(userId: UserId): Promise<DeviceKey | null>;
  abstract decryptUserKeyWithDeviceKey(
    userId: UserId,
    encryptedDevicePrivateKey: EncString,
    encryptedUserKey: EncString,
    deviceKey: DeviceKey,
  ): Promise<UserKey | null>;
  abstract rotateDevicesTrust(
    userId: UserId,
    newUserKey: UserKey,
    masterPasswordHash: string,
  ): Promise<void>;
  /**
   * Notifies the server that the device has a device key, but didn't receive any associated decryption keys.
   * Note: For debugging purposes only.
   */
  abstract recordDeviceTrustLoss(): Promise<void>;
  abstract getRotatedData(
    oldUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<OtherDeviceKeysUpdateRequest[]>;
}
