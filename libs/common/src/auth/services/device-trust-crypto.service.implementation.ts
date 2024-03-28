import { firstValueFrom, map, Observable } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";

import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoFunctionService } from "../../platform/abstractions/crypto-function.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { KeyGenerationService } from "../../platform/abstractions/key-generation.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { EncString } from "../../platform/models/domain/enc-string";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { DEVICE_TRUST_DISK_LOCAL, KeyDefinition, StateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";
import { UserKey, DeviceKey } from "../../types/key";
import { DeviceTrustCryptoServiceAbstraction } from "../abstractions/device-trust-crypto.service.abstraction";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import {
  DeviceKeysUpdateRequest,
  UpdateDevicesTrustRequest,
} from "../models/request/update-devices-trust.request";

/** Uses disk storage so that the device key can persist after log out and tab removal. */
export const DEVICE_KEY = new KeyDefinition<DeviceKey>(DEVICE_TRUST_DISK_LOCAL, "deviceKey", {
  deserializer: (deviceKey) => SymmetricCryptoKey.fromJSON(deviceKey) as DeviceKey,
});

/** Uses disk storage so that the shouldTrustDevice bool can persist across login. */
export const SHOULD_TRUST_DEVICE = new KeyDefinition<boolean>(
  DEVICE_TRUST_DISK_LOCAL,
  "shouldTrustDevice",
  {
    deserializer: (shouldTrustDevice) => shouldTrustDevice,
  },
);

export class DeviceTrustCryptoService implements DeviceTrustCryptoServiceAbstraction {
  private readonly platformSupportsSecureStorage =
    this.platformUtilsService.supportsSecureStorage();
  private readonly deviceKeySecureStorageKey: string = "_deviceKey";

  supportsDeviceTrust$: Observable<boolean>;

  constructor(
    private keyGenerationService: KeyGenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private appIdService: AppIdService,
    private devicesApiService: DevicesApiServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private stateProvider: StateProvider,
    private secureStorageService: AbstractStorageService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
  ) {
    this.supportsDeviceTrust$ = this.userDecryptionOptionsService.userDecryptionOptions$.pipe(
      map((options) => options?.trustedDeviceOption != null ?? false),
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
      await this.setShouldTrustDevice(userId, false);
    }
  }

  async trustDevice(userId: UserId): Promise<DeviceResponse> {
    if (!userId) {
      throw new Error("UserId is required. Cannot trust device.");
    }

    // Attempt to get user key
    const userKey: UserKey = await this.cryptoService.getUserKey();

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
      this.cryptoService.rsaEncrypt(userKey.key, devicePublicKey),

      // Encrypt devicePublicKey with user key
      this.encryptService.encrypt(devicePublicKey, userKey),

      // Encrypt devicePrivateKey with deviceKey
      this.encryptService.encrypt(devicePrivateKey, deviceKey),
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

    this.platformUtilsService.showToast("success", null, this.i18nService.t("deviceTrusted"));

    return deviceResponse;
  }

  async rotateDevicesTrust(
    userId: UserId,
    newUserKey: UserKey,
    masterPasswordHash: string,
  ): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot rotate device's trust.");
    }

    const currentDeviceKey = await this.getDeviceKey(userId);
    if (currentDeviceKey == null) {
      // If the current device doesn't have a device key available to it, then we can't
      // rotate any trust at all, so early return.
      return;
    }

    // At this point of rotating their keys, they should still have their old user key in state
    const oldUserKey = await firstValueFrom(this.cryptoService.activeUserKey$);

    const deviceIdentifier = await this.appIdService.getAppId();
    const secretVerificationRequest = new SecretVerificationRequest();
    secretVerificationRequest.masterPasswordHash = masterPasswordHash;

    // Get the keys that are used in rotating a devices keys from the server
    const currentDeviceKeys = await this.devicesApiService.getDeviceKeys(
      deviceIdentifier,
      secretVerificationRequest,
    );

    // Decrypt the existing device public key with the old user key
    const decryptedDevicePublicKey = await this.encryptService.decryptToBytes(
      currentDeviceKeys.encryptedPublicKey,
      oldUserKey,
    );

    // Encrypt the brand new user key with the now-decrypted public key for the device
    const encryptedNewUserKey = await this.cryptoService.rsaEncrypt(
      newUserKey.key,
      decryptedDevicePublicKey,
    );

    // Re-encrypt the device public key with the new user key
    const encryptedDevicePublicKey = await this.encryptService.encrypt(
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

    await this.devicesApiService.updateTrust(trustRequest, deviceIdentifier);
  }

  async getDeviceKey(userId: UserId): Promise<DeviceKey | null> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get device key.");
    }

    if (this.platformSupportsSecureStorage) {
      const deviceKeyB64 = await this.secureStorageService.get<
        ReturnType<SymmetricCryptoKey["toJSON"]>
      >(`${userId}${this.deviceKeySecureStorageKey}`, this.getSecureStorageOptions(userId));

      const deviceKey = SymmetricCryptoKey.fromJSON(deviceKeyB64) as DeviceKey;

      return deviceKey;
    }

    const deviceKey = await firstValueFrom(this.stateProvider.getUserState$(DEVICE_KEY, userId));

    return deviceKey;
  }

  private async setDeviceKey(userId: UserId, deviceKey: DeviceKey | null): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot set device key.");
    }

    if (this.platformSupportsSecureStorage) {
      await this.secureStorageService.save<DeviceKey>(
        `${userId}${this.deviceKeySecureStorageKey}`,
        deviceKey,
        this.getSecureStorageOptions(userId),
      );
      return;
    }

    await this.stateProvider.setUserState(DEVICE_KEY, deviceKey?.toJSON(), userId);
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

    if (!deviceKey) {
      // User doesn't have a device key anymore so device is untrusted
      return null;
    }

    try {
      // attempt to decrypt encryptedDevicePrivateKey with device key
      const devicePrivateKey = await this.encryptService.decryptToBytes(
        encryptedDevicePrivateKey,
        deviceKey,
      );

      // Attempt to decrypt encryptedUserDataKey with devicePrivateKey
      const userKey = await this.cryptoService.rsaDecrypt(
        encryptedUserKey.encryptedString,
        devicePrivateKey,
      );

      return new SymmetricCryptoKey(userKey) as UserKey;
    } catch (e) {
      // If either decryption effort fails, we want to remove the device key
      await this.setDeviceKey(userId, null);

      return null;
    }
  }

  private getSecureStorageOptions(userId: UserId): StorageOptions {
    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId: userId,
    };
  }
}
