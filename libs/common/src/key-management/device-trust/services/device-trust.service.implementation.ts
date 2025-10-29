// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { DeviceResponse } from "../../../auth/abstractions/devices/responses/device.response";
import { DevicesApiServiceAbstraction } from "../../../auth/abstractions/devices-api.service.abstraction";
import { SecretVerificationRequest } from "../../../auth/models/request/secret-verification.request";
import {
  DeviceKeysUpdateRequest,
  OtherDeviceKeysUpdateRequest,
  UpdateDevicesTrustRequest,
} from "../../../auth/models/request/update-devices-trust.request";
import { AppIdService } from "../../../platform/abstractions/app-id.service";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { AbstractStorageService } from "../../../platform/abstractions/storage.service";
import { StorageLocation } from "../../../platform/enums";
import { StorageOptions } from "../../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { DEVICE_TRUST_DISK_LOCAL, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { UserKey, DeviceKey } from "../../../types/key";
import { KeyGenerationService } from "../../crypto";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";
import { EncString } from "../../crypto/models/enc-string";
import { RotateableKeySet } from "../../keys/models/rotateable-key-set";
import { DeviceTrustServiceAbstraction } from "../abstractions/device-trust.service.abstraction";

/** Uses disk storage so that the device key can persist after log out and tab removal. */
export const DEVICE_KEY = new UserKeyDefinition<DeviceKey | null>(
  DEVICE_TRUST_DISK_LOCAL,
  "deviceKey",
  {
    deserializer: (deviceKey) =>
      deviceKey ? (SymmetricCryptoKey.fromJSON(deviceKey) as DeviceKey) : null,
    clearOn: [], // Device key is needed to log back into device, so we can't clear it automatically during lock or logout
    cleanupDelayMs: 0,
    debug: {
      enableRetrievalLogging: true,
      enableUpdateLogging: true,
    },
  },
);

/** Uses disk storage so that the shouldTrustDevice bool can persist across login. */
export const SHOULD_TRUST_DEVICE = new UserKeyDefinition<boolean | null>(
  DEVICE_TRUST_DISK_LOCAL,
  "shouldTrustDevice",
  {
    deserializer: (shouldTrustDevice) => shouldTrustDevice,
    clearOn: [], // Need to preserve the user setting, so we can't clear it automatically during lock or logout
  },
);

export class DeviceTrustService implements DeviceTrustServiceAbstraction {
  private readonly platformSupportsSecureStorage =
    this.platformUtilsService.supportsSecureStorage();
  private readonly deviceKeySecureStorageKey: string = "_deviceKey";

  supportsDeviceTrust$: Observable<boolean>;

  // Observable emission is used to trigger a toast in consuming components
  private deviceTrustedSubject = new Subject<void>();
  deviceTrusted$ = this.deviceTrustedSubject.asObservable();

  constructor(
    private keyGenerationService: KeyGenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private appIdService: AppIdService,
    private devicesApiService: DevicesApiServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private stateProvider: StateProvider,
    private secureStorageService: AbstractStorageService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private logService: LogService,
    private configService: ConfigService,
  ) {
    this.supportsDeviceTrust$ = this.userDecryptionOptionsService.userDecryptionOptions$.pipe(
      map((options) => {
        return options?.trustedDeviceOption != null;
      }),
    );
  }

  supportsDeviceTrustByUserId$(userId: UserId): Observable<boolean> {
    return this.userDecryptionOptionsService.userDecryptionOptionsById$(userId).pipe(
      map((options) => {
        return options?.trustedDeviceOption != null;
      }),
    );
  }

  /**
   * @description Retrieves the users choice to trust the device which can only happen after decryption
   * Note: this value should only be used once and then reset
   */
  async getShouldTrustDevice(userId: UserId): Promise<boolean> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get should trust device.");
    }

    const shouldTrustDevice = await firstValueFrom(
      this.stateProvider.getUserState$(SHOULD_TRUST_DEVICE, userId),
    );

    return shouldTrustDevice;
  }

  async setShouldTrustDevice(userId: UserId, value: boolean): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot set should trust device.");
    }

    await this.stateProvider.setUserState(SHOULD_TRUST_DEVICE, value, userId);
  }

  async trustDeviceIfRequired(userId: UserId): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot trust device if required.");
    }

    const shouldTrustDevice = await this.getShouldTrustDevice(userId);
    if (shouldTrustDevice) {
      await this.trustDevice(userId);
      // reset the trust choice
      await this.setShouldTrustDevice(userId, null);
    }
  }

  async trustDevice(userId: UserId): Promise<DeviceResponse> {
    if (!userId) {
      throw new Error("UserId is required. Cannot trust device.");
    }

    // Attempt to get user key
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    // If user key is not found, throw error
    if (!userKey) {
      throw new Error("User symmetric key not found");
    }

    // Generate deviceKey
    const deviceKey = await this.makeDeviceKey();

    // Generate asymmetric RSA key pair: devicePrivateKey, devicePublicKey
    const [devicePublicKey, devicePrivateKey] =
      await this.cryptoFunctionService.rsaGenerateKeyPair(2048);

    const [
      devicePublicKeyEncryptedUserKey,
      userKeyEncryptedDevicePublicKey,
      deviceKeyEncryptedDevicePrivateKey,
    ] = await Promise.all([
      // Encrypt user key with the DevicePublicKey
      this.encryptService.encapsulateKeyUnsigned(userKey, devicePublicKey),

      // Encrypt devicePublicKey with user key
      this.encryptService.wrapEncapsulationKey(devicePublicKey, userKey),

      // Encrypt devicePrivateKey with deviceKey
      this.encryptService.wrapDecapsulationKey(devicePrivateKey, deviceKey),
    ]);

    // Send encrypted keys to server
    const deviceIdentifier = await this.appIdService.getAppId();
    const deviceResponse = await this.devicesApiService.updateTrustedDeviceKeys(
      deviceIdentifier,
      devicePublicKeyEncryptedUserKey.encryptedString,
      userKeyEncryptedDevicePublicKey.encryptedString,
      deviceKeyEncryptedDevicePrivateKey.encryptedString,
    );

    // store device key in local/secure storage if enc keys posted to server successfully
    await this.setDeviceKey(userId, deviceKey);

    // This emission will be picked up by consuming components to handle displaying a toast to the user
    this.deviceTrustedSubject.next();

    return deviceResponse;
  }

  async getRotatedData(
    oldUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<OtherDeviceKeysUpdateRequest[]> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get rotated data.");
    }
    if (!oldUserKey) {
      throw new Error("Old user key is required. Cannot get rotated data.");
    }
    if (!newUserKey) {
      throw new Error("New user key is required. Cannot get rotated data.");
    }

    const devices = await this.devicesApiService.getDevices();
    const devicesToUntrust: string[] = [];
    const rotatedData = await Promise.all(
      devices.data
        .filter((device) => device.isTrusted)
        .map(async (device) => {
          const publicKey = await this.encryptService.unwrapEncapsulationKey(
            new EncString(device.encryptedPublicKey),
            oldUserKey,
          );

          if (!publicKey) {
            // Device was trusted but encryption is broken. This should be untrusted
            devicesToUntrust.push(device.id);
            return null;
          }

          const newEncryptedPublicKey = await this.encryptService.wrapEncapsulationKey(
            publicKey,
            newUserKey,
          );
          const newEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
            newUserKey,
            publicKey,
          );

          const newRotateableKeySet = new RotateableKeySet(
            newEncryptedUserKey,
            newEncryptedPublicKey,
          );

          const request = new OtherDeviceKeysUpdateRequest();
          request.encryptedPublicKey = newRotateableKeySet.encryptedPublicKey.encryptedString;
          request.encryptedUserKey = newRotateableKeySet.encryptedRotateableKey.encryptedString;
          request.deviceId = device.id;
          return request;
        })
        .filter((otherDeviceKeysUpdateRequest) => otherDeviceKeysUpdateRequest != null),
    );
    if (rotatedData.length > 0) {
      this.logService.info("[Device trust rotation] Distrusting devices that failed to decrypt.");
      await this.devicesApiService.untrustDevices(devicesToUntrust);
    }
    return rotatedData;
  }

  async rotateDevicesTrust(
    userId: UserId,
    newUserKey: UserKey,
    masterPasswordHash: string,
  ): Promise<void> {
    this.logService.info("[Device trust rotation] Rotating device trust...");
    if (!userId) {
      throw new Error("UserId is required. Cannot rotate device's trust.");
    }

    const currentDeviceKey = await this.getDeviceKey(userId);
    if (currentDeviceKey == null) {
      // If the current device doesn't have a device key available to it, then we can't
      // rotate any trust at all, so early return.
      this.logService.info("[Device trust rotation] No device key available to rotate trust!");
      return;
    }

    // At this point of rotating their keys, they should still have their old user key in state
    const oldUserKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (oldUserKey == newUserKey) {
      this.logService.info("[Device trust rotation] Old user key is the same as the new user key.");
    }

    const deviceIdentifier = await this.appIdService.getAppId();
    const secretVerificationRequest = new SecretVerificationRequest();
    secretVerificationRequest.masterPasswordHash = masterPasswordHash;

    // Get the keys that are used in rotating a devices keys from the server
    const currentDeviceKeys = await this.devicesApiService.getDeviceKeys(deviceIdentifier);

    // Decrypt the existing device public key with the old user key
    const decryptedDevicePublicKey = await this.encryptService.unwrapEncapsulationKey(
      currentDeviceKeys.encryptedPublicKey,
      oldUserKey,
    );

    // Encrypt the brand new user key with the now-decrypted public key for the device
    const encryptedNewUserKey = await this.encryptService.encapsulateKeyUnsigned(
      newUserKey,
      decryptedDevicePublicKey,
    );

    // Re-encrypt the device public key with the new user key
    const encryptedDevicePublicKey = await this.encryptService.wrapEncapsulationKey(
      decryptedDevicePublicKey,
      newUserKey,
    );

    const currentDeviceUpdateRequest = new DeviceKeysUpdateRequest();
    currentDeviceUpdateRequest.encryptedUserKey = encryptedNewUserKey.encryptedString;
    currentDeviceUpdateRequest.encryptedPublicKey = encryptedDevicePublicKey.encryptedString;

    // TODO: For device management, allow this method to take an array of device ids that can be looped over and individually rotated
    // then it can be added to trustRequest.otherDevices.

    const trustRequest = new UpdateDevicesTrustRequest();
    trustRequest.masterPasswordHash = masterPasswordHash;
    trustRequest.currentDevice = currentDeviceUpdateRequest;
    trustRequest.otherDevices = [];

    this.logService.info(
      "[Device trust rotation] Posting device trust update with current device:",
      deviceIdentifier,
    );
    await this.devicesApiService.updateTrust(trustRequest, deviceIdentifier);
    this.logService.info("[Device trust rotation] Device trust update posted successfully.");
  }

  async getDeviceKey(userId: UserId): Promise<DeviceKey | null> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get device key.");
    }

    try {
      if (this.platformSupportsSecureStorage) {
        const deviceKeyB64 = await this.secureStorageService.get<
          ReturnType<SymmetricCryptoKey["toJSON"]>
        >(`${userId}${this.deviceKeySecureStorageKey}`, this.getSecureStorageOptions(userId));

        const deviceKey = SymmetricCryptoKey.fromJSON(deviceKeyB64) as DeviceKey;

        return deviceKey;
      }

      const deviceKey = await firstValueFrom(this.stateProvider.getUserState$(DEVICE_KEY, userId));

      return deviceKey;
    } catch (e) {
      this.logService.error("Failed to get device key", e);
    }
  }

  private async setDeviceKey(userId: UserId, deviceKey: DeviceKey | null): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot set device key.");
    }

    try {
      if (this.platformSupportsSecureStorage) {
        await this.secureStorageService.save<DeviceKey>(
          `${userId}${this.deviceKeySecureStorageKey}`,
          deviceKey,
          this.getSecureStorageOptions(userId),
        );
        return;
      }

      await this.stateProvider.setUserState(DEVICE_KEY, deviceKey?.toJSON(), userId);
    } catch (e) {
      this.logService.error("Failed to set device key", e);
    }
  }

  private async makeDeviceKey(): Promise<DeviceKey> {
    // Create 512-bit device key
    const deviceKey = (await this.keyGenerationService.createKey(512)) as DeviceKey;

    return deviceKey;
  }

  async decryptUserKeyWithDeviceKey(
    userId: UserId,
    encryptedDevicePrivateKey: EncString,
    encryptedUserKey: EncString,
    deviceKey: DeviceKey,
  ): Promise<UserKey | null> {
    if (!userId) {
      throw new Error("UserId is required. Cannot decrypt user key with device key.");
    }

    if (!encryptedDevicePrivateKey) {
      throw new Error(
        "Encrypted device private key is required. Cannot decrypt user key with device key.",
      );
    }

    if (!encryptedUserKey) {
      throw new Error("Encrypted user key is required. Cannot decrypt user key with device key.");
    }

    if (!deviceKey) {
      // User doesn't have a device key anymore so device is untrusted
      return null;
    }

    try {
      // attempt to decrypt encryptedDevicePrivateKey with device key
      const devicePrivateKey = await this.encryptService.unwrapDecapsulationKey(
        encryptedDevicePrivateKey,
        deviceKey,
      );

      // Attempt to decrypt encryptedUserDataKey with devicePrivateKey
      const userKey = await this.encryptService.decapsulateKeyUnsigned(
        new EncString(encryptedUserKey.encryptedString),
        devicePrivateKey,
      );

      return userKey as UserKey;
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // If either decryption effort fails, we want to remove the device key
      this.logService.error("Failed to decrypt using device key. Removing device key.");
      await this.setDeviceKey(userId, null);

      return null;
    }
  }

  async recordDeviceTrustLoss(): Promise<void> {
    const deviceIdentifier = await this.appIdService.getAppId();
    await this.devicesApiService.postDeviceTrustLoss(deviceIdentifier);
  }

  private getSecureStorageOptions(userId: UserId): StorageOptions {
    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId: userId,
    };
  }
}
