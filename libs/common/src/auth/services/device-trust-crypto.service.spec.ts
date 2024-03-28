import { matches, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";

import { UserDecryptionOptions } from "../../../../auth/src/common/models/domain/user-decryption-options";
import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeActiveUserState } from "../../../spec/fake-state";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { DeviceType } from "../../enums";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoFunctionService } from "../../platform/abstractions/crypto-function.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { KeyGenerationService } from "../../platform/abstractions/key-generation.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { EncryptionType } from "../../platform/enums/encryption-type.enum";
import { Utils } from "../../platform/misc/utils";
import { EncString } from "../../platform/models/domain/enc-string";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { DeviceKey, UserKey } from "../../types/key";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

import {
  SHOULD_TRUST_DEVICE,
  DEVICE_KEY,
  DeviceTrustCryptoService,
} from "./device-trust-crypto.service.implementation";

describe("deviceTrustCryptoService", () => {
  let deviceTrustCryptoService: DeviceTrustCryptoService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const cryptoService = mock<CryptoService>();
  const encryptService = mock<EncryptService>();
  const appIdService = mock<AppIdService>();
  const devicesApiService = mock<DevicesApiServiceAbstraction>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const secureStorageService = mock<AbstractStorageService>();

  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const decryptionOptions = new BehaviorSubject<UserDecryptionOptions>(null);

  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  const deviceKeyPartialSecureStorageKey = "_deviceKey";
  const deviceKeySecureStorageKey = `${mockUserId}${deviceKeyPartialSecureStorageKey}`;

  const secureStorageOptions: StorageOptions = {
    storageLocation: StorageLocation.Disk,
    useSecureStorage: true,
    userId: mockUserId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const supportsSecureStorage = false; // default to false; tests will override as needed
    // By default all the tests will have a mocked active user in state provider.
    deviceTrustCryptoService = createDeviceTrustCryptoService(mockUserId, supportsSecureStorage);
  });

  it("instantiates", () => {
    expect(deviceTrustCryptoService).not.toBeFalsy();
  });

  describe("User Trust Device Choice For Decryption", () => {
    describe("getShouldTrustDevice", () => {
      it("gets the user trust device choice for decryption", async () => {
        const newValue = true;

        await stateProvider.setUserState(SHOULD_TRUST_DEVICE, newValue, mockUserId);

        const result = await deviceTrustCryptoService.getShouldTrustDevice(mockUserId);

        expect(result).toEqual(newValue);
      });
    });

    describe("setShouldTrustDevice", () => {
      it("sets the user trust device choice for decryption ", async () => {
        await stateProvider.setUserState(SHOULD_TRUST_DEVICE, false, mockUserId);

        const newValue = true;
        await deviceTrustCryptoService.setShouldTrustDevice(mockUserId, newValue);

        const result = await deviceTrustCryptoService.getShouldTrustDevice(mockUserId);
        expect(result).toEqual(newValue);
      });
    });
  });

  describe("trustDeviceIfRequired", () => {
    it("should trust device and reset when getShouldTrustDevice returns true", async () => {
      jest.spyOn(deviceTrustCryptoService, "getShouldTrustDevice").mockResolvedValue(true);
      jest.spyOn(deviceTrustCryptoService, "trustDevice").mockResolvedValue({} as DeviceResponse);
      jest.spyOn(deviceTrustCryptoService, "setShouldTrustDevice").mockResolvedValue();

      await deviceTrustCryptoService.trustDeviceIfRequired(mockUserId);

      expect(deviceTrustCryptoService.getShouldTrustDevice).toHaveBeenCalledTimes(1);
      expect(deviceTrustCryptoService.trustDevice).toHaveBeenCalledTimes(1);
      expect(deviceTrustCryptoService.setShouldTrustDevice).toHaveBeenCalledWith(mockUserId, false);
    });

    it("should not trust device nor reset when getShouldTrustDevice returns false", async () => {
      const getShouldTrustDeviceSpy = jest
        .spyOn(deviceTrustCryptoService, "getShouldTrustDevice")
        .mockResolvedValue(false);
      const trustDeviceSpy = jest.spyOn(deviceTrustCryptoService, "trustDevice");
      const setShouldTrustDeviceSpy = jest.spyOn(deviceTrustCryptoService, "setShouldTrustDevice");

      await deviceTrustCryptoService.trustDeviceIfRequired(mockUserId);

      expect(getShouldTrustDeviceSpy).toHaveBeenCalledTimes(1);
      expect(trustDeviceSpy).not.toHaveBeenCalled();
      expect(setShouldTrustDeviceSpy).not.toHaveBeenCalled();
    });
  });

  describe("Trusted Device Encryption core logic tests", () => {
    const deviceKeyBytesLength = 64;
    const userKeyBytesLength = 64;

    describe("getDeviceKey", () => {
      let existingDeviceKey: DeviceKey;
      let existingDeviceKeyB64: { keyB64: string };

      beforeEach(() => {
        existingDeviceKey = new SymmetricCryptoKey(
          new Uint8Array(deviceKeyBytesLength) as CsprngArray,
        ) as DeviceKey;

        existingDeviceKeyB64 = existingDeviceKey.toJSON();
      });

      describe("Secure Storage not supported", () => {
        it("returns null when there is not an existing device key", async () => {
          await stateProvider.setUserState(DEVICE_KEY, null, mockUserId);

          const deviceKey = await deviceTrustCryptoService.getDeviceKey(mockUserId);

          expect(deviceKey).toBeNull();
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });

        it("returns the device key when there is an existing device key", async () => {
          await stateProvider.setUserState(DEVICE_KEY, existingDeviceKey, mockUserId);

          const deviceKey = await deviceTrustCryptoService.getDeviceKey(mockUserId);

          expect(deviceKey).not.toBeNull();
          expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
          expect(deviceKey).toEqual(existingDeviceKey);
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });
      });

      describe("Secure Storage supported", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          deviceTrustCryptoService = createDeviceTrustCryptoService(
            mockUserId,
            supportsSecureStorage,
          );
        });

        it("returns null when there is not an existing device key for the passed in user id", async () => {
          secureStorageService.get.mockResolvedValue(null);

          // Act
          const deviceKey = await deviceTrustCryptoService.getDeviceKey(mockUserId);

          // Assert
          expect(deviceKey).toBeNull();
        });

        it("returns the device key when there is an existing device key for the passed in user id", async () => {
          // Arrange
          secureStorageService.get.mockResolvedValue(existingDeviceKeyB64);

          // Act
          const deviceKey = await deviceTrustCryptoService.getDeviceKey(mockUserId);

          // Assert
          expect(deviceKey).not.toBeNull();
          expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
          expect(deviceKey).toEqual(existingDeviceKey);
        });
      });

      it("throws an error when no user id is passed in", async () => {
        await expect(deviceTrustCryptoService.getDeviceKey(null)).rejects.toThrow(
          "UserId is required. Cannot get device key.",
        );
      });
    });

    describe("setDeviceKey", () => {
      describe("Secure Storage not supported", () => {
        it("successfully sets the device key in state provider", async () => {
          await stateProvider.setUserState(DEVICE_KEY, null, mockUserId);

          const newDeviceKey = new SymmetricCryptoKey(
            new Uint8Array(deviceKeyBytesLength) as CsprngArray,
          ) as DeviceKey;

          // TypeScript will allow calling private methods if the object is of type 'any'
          // This is a hacky workaround, but it allows for cleaner tests
          await (deviceTrustCryptoService as any).setDeviceKey(mockUserId, newDeviceKey);

          expect(stateProvider.mock.setUserState).toHaveBeenLastCalledWith(
            DEVICE_KEY,
            newDeviceKey.toJSON(),
            mockUserId,
          );
        });
      });
      describe("Secure Storage supported", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          deviceTrustCryptoService = createDeviceTrustCryptoService(
            mockUserId,
            supportsSecureStorage,
          );
        });

        it("successfully sets the device key in secure storage", async () => {
          // Arrange
          await stateProvider.setUserState(DEVICE_KEY, null, mockUserId);

          secureStorageService.get.mockResolvedValue(null);

          const newDeviceKey = new SymmetricCryptoKey(
            new Uint8Array(deviceKeyBytesLength) as CsprngArray,
          ) as DeviceKey;

          // Act
          // TypeScript will allow calling private methods if the object is of type 'any'
          // This is a hacky workaround, but it allows for cleaner tests
          await (deviceTrustCryptoService as any).setDeviceKey(mockUserId, newDeviceKey);

          // Assert
          expect(stateProvider.mock.setUserState).not.toHaveBeenCalledTimes(2);
          expect(secureStorageService.save).toHaveBeenCalledWith(
            deviceKeySecureStorageKey,
            newDeviceKey,
            secureStorageOptions,
          );
        });
      });

      it("throws an error when a null user id is passed in", async () => {
        const newDeviceKey = new SymmetricCryptoKey(
          new Uint8Array(deviceKeyBytesLength) as CsprngArray,
        ) as DeviceKey;

        await expect(
          (deviceTrustCryptoService as any).setDeviceKey(null, newDeviceKey),
        ).rejects.toThrow("UserId is required. Cannot set device key.");
      });
    });

    describe("makeDeviceKey", () => {
      it("creates a new non-null 64 byte device key, securely stores it, and returns it", async () => {
        const mockRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;
        const mockDeviceKey = new SymmetricCryptoKey(mockRandomBytes) as DeviceKey;

        const keyGenSvcGenerateKeySpy = jest
          .spyOn(keyGenerationService, "createKey")
          .mockResolvedValue(mockDeviceKey);

        // TypeScript will allow calling private methods if the object is of type 'any'
        // This is a hacky workaround, but it allows for cleaner tests
        const deviceKey = await (deviceTrustCryptoService as any).makeDeviceKey();

        expect(keyGenSvcGenerateKeySpy).toHaveBeenCalledTimes(1);
        expect(keyGenSvcGenerateKeySpy).toHaveBeenCalledWith(deviceKeyBytesLength * 8);

        expect(deviceKey).not.toBeNull();
        expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
      });
    });

    describe("trustDevice", () => {
      let mockDeviceKeyRandomBytes: CsprngArray;
      let mockDeviceKey: DeviceKey;

      let mockUserKeyRandomBytes: CsprngArray;
      let mockUserKey: UserKey;

      const deviceRsaKeyLength = 2048;
      let mockDeviceRsaKeyPair: [Uint8Array, Uint8Array];
      let mockDevicePrivateKey: Uint8Array;
      let mockDevicePublicKey: Uint8Array;
      let mockDevicePublicKeyEncryptedUserKey: EncString;
      let mockUserKeyEncryptedDevicePublicKey: EncString;
      let mockDeviceKeyEncryptedDevicePrivateKey: EncString;

      const mockDeviceResponse: DeviceResponse = new DeviceResponse({
        Id: "mockId",
        Name: "mockName",
        Identifier: "mockIdentifier",
        Type: "mockType",
        CreationDate: "mockCreationDate",
      });

      const mockDeviceId = "mockDeviceId";

      let makeDeviceKeySpy: jest.SpyInstance;
      let rsaGenerateKeyPairSpy: jest.SpyInstance;
      let cryptoSvcGetUserKeySpy: jest.SpyInstance;
      let cryptoSvcRsaEncryptSpy: jest.SpyInstance;
      let encryptServiceEncryptSpy: jest.SpyInstance;
      let appIdServiceGetAppIdSpy: jest.SpyInstance;
      let devicesApiServiceUpdateTrustedDeviceKeysSpy: jest.SpyInstance;

      beforeEach(() => {
        // Setup all spies and default return values for the happy path

        mockDeviceKeyRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;
        mockDeviceKey = new SymmetricCryptoKey(mockDeviceKeyRandomBytes) as DeviceKey;

        mockUserKeyRandomBytes = new Uint8Array(userKeyBytesLength) as CsprngArray;
        mockUserKey = new SymmetricCryptoKey(mockUserKeyRandomBytes) as UserKey;

        mockDeviceRsaKeyPair = [
          new Uint8Array(deviceRsaKeyLength),
          new Uint8Array(deviceRsaKeyLength),
        ];

        mockDevicePublicKey = mockDeviceRsaKeyPair[0];
        mockDevicePrivateKey = mockDeviceRsaKeyPair[1];

        mockDevicePublicKeyEncryptedUserKey = new EncString(
          EncryptionType.Rsa2048_OaepSha1_B64,
          "mockDevicePublicKeyEncryptedUserKey",
        );

        mockUserKeyEncryptedDevicePublicKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserKeyEncryptedDevicePublicKey",
        );

        mockDeviceKeyEncryptedDevicePrivateKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockDeviceKeyEncryptedDevicePrivateKey",
        );

        // TypeScript will allow calling private methods if the object is of type 'any'
        makeDeviceKeySpy = jest
          .spyOn(deviceTrustCryptoService as any, "makeDeviceKey")
          .mockResolvedValue(mockDeviceKey);

        rsaGenerateKeyPairSpy = jest
          .spyOn(cryptoFunctionService, "rsaGenerateKeyPair")
          .mockResolvedValue(mockDeviceRsaKeyPair);

        cryptoSvcGetUserKeySpy = jest
          .spyOn(cryptoService, "getUserKey")
          .mockResolvedValue(mockUserKey);

        cryptoSvcRsaEncryptSpy = jest
          .spyOn(cryptoService, "rsaEncrypt")
          .mockResolvedValue(mockDevicePublicKeyEncryptedUserKey);

        encryptServiceEncryptSpy = jest
          .spyOn(encryptService, "encrypt")
          .mockImplementation((plainValue, key) => {
            if (plainValue === mockDevicePublicKey && key === mockUserKey) {
              return Promise.resolve(mockUserKeyEncryptedDevicePublicKey);
            }
            if (plainValue === mockDevicePrivateKey && key === mockDeviceKey) {
              return Promise.resolve(mockDeviceKeyEncryptedDevicePrivateKey);
            }
          });

        appIdServiceGetAppIdSpy = jest
          .spyOn(appIdService, "getAppId")
          .mockResolvedValue(mockDeviceId);

        devicesApiServiceUpdateTrustedDeviceKeysSpy = jest
          .spyOn(devicesApiService, "updateTrustedDeviceKeys")
          .mockResolvedValue(mockDeviceResponse);
      });

      it("calls the required methods with the correct arguments and returns a DeviceResponse", async () => {
        const response = await deviceTrustCryptoService.trustDevice(mockUserId);

        expect(makeDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(rsaGenerateKeyPairSpy).toHaveBeenCalledTimes(1);
        expect(cryptoSvcGetUserKeySpy).toHaveBeenCalledTimes(1);

        expect(cryptoSvcRsaEncryptSpy).toHaveBeenCalledTimes(1);

        // RsaEncrypt must be called w/ a user key array buffer of 64 bytes
        const userKeyKey: Uint8Array = cryptoSvcRsaEncryptSpy.mock.calls[0][0];
        expect(userKeyKey.byteLength).toBe(64);

        expect(encryptServiceEncryptSpy).toHaveBeenCalledTimes(2);

        expect(appIdServiceGetAppIdSpy).toHaveBeenCalledTimes(1);
        expect(devicesApiServiceUpdateTrustedDeviceKeysSpy).toHaveBeenCalledTimes(1);
        expect(devicesApiServiceUpdateTrustedDeviceKeysSpy).toHaveBeenCalledWith(
          mockDeviceId,
          mockDevicePublicKeyEncryptedUserKey.encryptedString,
          mockUserKeyEncryptedDevicePublicKey.encryptedString,
          mockDeviceKeyEncryptedDevicePrivateKey.encryptedString,
        );

        expect(response).toBeInstanceOf(DeviceResponse);
        expect(response).toEqual(mockDeviceResponse);
      });

      it("throws specific error if user key is not found", async () => {
        // setup the spy to return null
        cryptoSvcGetUserKeySpy.mockResolvedValue(null);
        // check if the expected error is thrown
        await expect(deviceTrustCryptoService.trustDevice(mockUserId)).rejects.toThrow(
          "User symmetric key not found",
        );

        // reset the spy
        cryptoSvcGetUserKeySpy.mockReset();

        // setup the spy to return undefined
        cryptoSvcGetUserKeySpy.mockResolvedValue(undefined);
        // check if the expected error is thrown
        await expect(deviceTrustCryptoService.trustDevice(mockUserId)).rejects.toThrow(
          "User symmetric key not found",
        );
      });

      const methodsToTestForErrorsOrInvalidReturns: any = [
        {
          method: "makeDeviceKey",
          spy: () => makeDeviceKeySpy,
          errorText: "makeDeviceKey error",
        },
        {
          method: "rsaGenerateKeyPair",
          spy: () => rsaGenerateKeyPairSpy,
          errorText: "rsaGenerateKeyPair error",
        },
        {
          method: "getUserKey",
          spy: () => cryptoSvcGetUserKeySpy,
          errorText: "getUserKey error",
        },
        {
          method: "rsaEncrypt",
          spy: () => cryptoSvcRsaEncryptSpy,
          errorText: "rsaEncrypt error",
        },
        {
          method: "encryptService.encrypt",
          spy: () => encryptServiceEncryptSpy,
          errorText: "encryptService.encrypt error",
        },
      ];

      describe.each(methodsToTestForErrorsOrInvalidReturns)(
        "trustDevice error handling and invalid return testing",
        ({ method, spy, errorText }) => {
          // ensures that error propagation works correctly
          it(`throws an error if ${method} fails`, async () => {
            const methodSpy = spy();
            methodSpy.mockRejectedValue(new Error(errorText));
            await expect(deviceTrustCryptoService.trustDevice(mockUserId)).rejects.toThrow(
              errorText,
            );
          });

          test.each([null, undefined])(
            `throws an error if ${method} returns %s`,
            async (invalidValue) => {
              const methodSpy = spy();
              methodSpy.mockResolvedValue(invalidValue);
              await expect(deviceTrustCryptoService.trustDevice(mockUserId)).rejects.toThrow();
            },
          );
        },
      );

      it("throws an error when a null user id is passed in", async () => {
        await expect(deviceTrustCryptoService.trustDevice(null)).rejects.toThrow(
          "UserId is required. Cannot trust device.",
        );
      });
    });

    describe("decryptUserKeyWithDeviceKey", () => {
      let mockDeviceKey: DeviceKey;
      let mockEncryptedDevicePrivateKey: EncString;
      let mockEncryptedUserKey: EncString;
      let mockUserKey: UserKey;

      beforeEach(() => {
        const mockDeviceKeyRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;
        mockDeviceKey = new SymmetricCryptoKey(mockDeviceKeyRandomBytes) as DeviceKey;

        const mockUserKeyRandomBytes = new Uint8Array(userKeyBytesLength) as CsprngArray;
        mockUserKey = new SymmetricCryptoKey(mockUserKeyRandomBytes) as UserKey;

        mockEncryptedDevicePrivateKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockEncryptedDevicePrivateKey",
        );

        mockEncryptedUserKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockEncryptedUserKey",
        );

        jest.clearAllMocks();
      });

      it("throws an error when a null user id is passed in", async () => {
        await expect(
          deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
            null,
            mockEncryptedDevicePrivateKey,
            mockEncryptedUserKey,
            mockDeviceKey,
          ),
        ).rejects.toThrow("UserId is required. Cannot decrypt user key with device key.");
      });

      it("returns null when device key isn't provided", async () => {
        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockUserId,
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey,
          mockDeviceKey,
        );

        expect(result).toBeNull();
      });

      it("successfully returns the user key when provided keys (including device key) can decrypt it", async () => {
        const decryptToBytesSpy = jest
          .spyOn(encryptService, "decryptToBytes")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));
        const rsaDecryptSpy = jest
          .spyOn(cryptoService, "rsaDecrypt")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));

        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockUserId,
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey,
          mockDeviceKey,
        );

        expect(result).toEqual(mockUserKey);
        expect(decryptToBytesSpy).toHaveBeenCalledTimes(1);
        expect(rsaDecryptSpy).toHaveBeenCalledTimes(1);
      });

      it("returns null and removes device key when the decryption fails", async () => {
        const decryptToBytesSpy = jest
          .spyOn(encryptService, "decryptToBytes")
          .mockRejectedValue(new Error("Decryption error"));
        const setDeviceKeySpy = jest.spyOn(deviceTrustCryptoService as any, "setDeviceKey");

        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockUserId,
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey,
          mockDeviceKey,
        );

        expect(result).toBeNull();
        expect(decryptToBytesSpy).toHaveBeenCalledTimes(1);
        expect(setDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(setDeviceKeySpy).toHaveBeenCalledWith(mockUserId, null);
      });
    });

    describe("rotateDevicesTrust", () => {
      let fakeNewUserKey: UserKey = null;

      const FakeNewUserKeyMarker = 1;
      const FakeOldUserKeyMarker = 5;
      const FakeDecryptedPublicKeyMarker = 17;

      beforeEach(() => {
        const fakeNewUserKeyData = new Uint8Array(64);
        fakeNewUserKeyData.fill(FakeNewUserKeyMarker, 0, 1);
        fakeNewUserKey = new SymmetricCryptoKey(fakeNewUserKeyData) as UserKey;
        cryptoService.activeUserKey$ = of(fakeNewUserKey);
      });

      it("throws an error when a null user id is passed in", async () => {
        await expect(
          deviceTrustCryptoService.rotateDevicesTrust(null, fakeNewUserKey, ""),
        ).rejects.toThrow("UserId is required. Cannot rotate device's trust.");
      });

      it("does an early exit when the current device is not a trusted device", async () => {
        const deviceKeyState: FakeActiveUserState<DeviceKey> =
          stateProvider.activeUser.getFake(DEVICE_KEY);
        deviceKeyState.nextState(null);

        await deviceTrustCryptoService.rotateDevicesTrust(mockUserId, fakeNewUserKey, "");

        expect(devicesApiService.updateTrust).not.toHaveBeenCalled();
      });

      describe("is on a trusted device", () => {
        beforeEach(async () => {
          const mockDeviceKey = new SymmetricCryptoKey(
            new Uint8Array(deviceKeyBytesLength),
          ) as DeviceKey;
          await stateProvider.setUserState(DEVICE_KEY, mockDeviceKey, mockUserId);
        });

        it("rotates current device keys and calls api service when the current device is trusted", async () => {
          const currentEncryptedPublicKey = new EncString("2.cHVibGlj|cHVibGlj|cHVibGlj");
          const currentEncryptedUserKey = new EncString("4.dXNlcg==");

          const fakeOldUserKeyData = new Uint8Array(new Uint8Array(64));
          // Fill the first byte with something identifiable
          fakeOldUserKeyData.fill(FakeOldUserKeyMarker, 0, 1);

          // Mock the retrieval of a user key that differs from the new one passed into the method
          cryptoService.activeUserKey$ = of(new SymmetricCryptoKey(fakeOldUserKeyData) as UserKey);

          appIdService.getAppId.mockResolvedValue("test_device_identifier");

          devicesApiService.getDeviceKeys.mockImplementation((deviceIdentifier, secretRequest) => {
            if (
              deviceIdentifier !== "test_device_identifier" ||
              secretRequest.masterPasswordHash !== "my_password_hash"
            ) {
              return Promise.resolve(null);
            }

            return Promise.resolve(
              new ProtectedDeviceResponse({
                id: "",
                creationDate: "",
                identifier: "test_device_identifier",
                name: "Firefox",
                type: DeviceType.FirefoxBrowser,
                encryptedPublicKey: currentEncryptedPublicKey.encryptedString,
                encryptedUserKey: currentEncryptedUserKey.encryptedString,
              }),
            );
          });

          // Mock the decryption of the public key with the old user key
          encryptService.decryptToBytes.mockImplementationOnce((_encValue, privateKeyValue) => {
            expect(privateKeyValue.key.byteLength).toBe(64);
            expect(new Uint8Array(privateKeyValue.key)[0]).toBe(FakeOldUserKeyMarker);
            const data = new Uint8Array(250);
            data.fill(FakeDecryptedPublicKeyMarker, 0, 1);
            return Promise.resolve(data);
          });

          // Mock the encryption of the new user key with the decrypted public key
          cryptoService.rsaEncrypt.mockImplementationOnce((data, publicKey) => {
            expect(data.byteLength).toBe(64); // New key should also be 64 bytes
            expect(new Uint8Array(data)[0]).toBe(FakeNewUserKeyMarker); // New key should have the first byte be '1';

            expect(new Uint8Array(publicKey)[0]).toBe(FakeDecryptedPublicKeyMarker);
            return Promise.resolve(new EncString("4.ZW5jcnlwdGVkdXNlcg=="));
          });

          // Mock the reencryption of the device public key with the new user key
          encryptService.encrypt.mockImplementationOnce((plainValue, key) => {
            expect(plainValue).toBeInstanceOf(Uint8Array);
            expect(new Uint8Array(plainValue as Uint8Array)[0]).toBe(FakeDecryptedPublicKeyMarker);

            expect(new Uint8Array(key.key)[0]).toBe(FakeNewUserKeyMarker);
            return Promise.resolve(
              new EncString("2.ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj"),
            );
          });

          await deviceTrustCryptoService.rotateDevicesTrust(
            mockUserId,
            fakeNewUserKey,
            "my_password_hash",
          );

          expect(devicesApiService.updateTrust).toHaveBeenCalledWith(
            matches((updateTrustModel: UpdateDevicesTrustRequest) => {
              return (
                updateTrustModel.currentDevice.encryptedPublicKey ===
                  "2.ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj" &&
                updateTrustModel.currentDevice.encryptedUserKey === "4.ZW5jcnlwdGVkdXNlcg=="
              );
            }),
            expect.stringMatching("test_device_identifier"),
          );
        });
      });
    });
  });

  // Helpers
  function createDeviceTrustCryptoService(
    mockUserId: UserId | null,
    supportsSecureStorage: boolean,
  ) {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    platformUtilsService.supportsSecureStorage.mockReturnValue(supportsSecureStorage);

    decryptionOptions.next({} as any);
    userDecryptionOptionsService.userDecryptionOptions$ = decryptionOptions;

    return new DeviceTrustCryptoService(
      keyGenerationService,
      cryptoFunctionService,
      cryptoService,
      encryptService,
      appIdService,
      devicesApiService,
      i18nService,
      platformUtilsService,
      stateProvider,
      secureStorageService,
      userDecryptionOptionsService,
    );
  }
});
