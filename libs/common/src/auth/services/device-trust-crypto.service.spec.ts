import { matches, mock } from "jest-mock-extended";

import { DeviceResponse } from "../../abstractions/devices/responses/device.response";
import { DeviceType } from "../../enums";
import { EncryptionType } from "../../enums/encryption-type.enum";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoFunctionService } from "../../platform/abstractions/crypto-function.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { EncString } from "../../platform/models/domain/enc-string";
import {
  SymmetricCryptoKey,
  DeviceKey,
  UserKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

import { DeviceTrustCryptoService } from "./device-trust-crypto.service.implementation";
describe("deviceTrustCryptoService", () => {
  let deviceTrustCryptoService: DeviceTrustCryptoService;

  const cryptoFunctionService = mock<CryptoFunctionService>();
  const cryptoService = mock<CryptoService>();
  const encryptService = mock<EncryptService>();
  const stateService = mock<StateService>();
  const appIdService = mock<AppIdService>();
  const devicesApiService = mock<DevicesApiServiceAbstraction>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    jest.clearAllMocks();

    deviceTrustCryptoService = new DeviceTrustCryptoService(
      cryptoFunctionService,
      cryptoService,
      encryptService,
      stateService,
      appIdService,
      devicesApiService,
      i18nService,
      platformUtilsService
    );
  });

  it("instantiates", () => {
    expect(deviceTrustCryptoService).not.toBeFalsy();
  });

  describe("User Trust Device Choice For Decryption", () => {
    describe("getShouldTrustDevice", () => {
      it("gets the user trust device choice for decryption from the state service", async () => {
        const stateSvcGetShouldTrustDeviceSpy = jest.spyOn(stateService, "getShouldTrustDevice");

        const expectedValue = true;
        stateSvcGetShouldTrustDeviceSpy.mockResolvedValue(expectedValue);
        const result = await deviceTrustCryptoService.getShouldTrustDevice();

        expect(stateSvcGetShouldTrustDeviceSpy).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expectedValue);
      });
    });

    describe("setShouldTrustDevice", () => {
      it("sets the user trust device choice for decryption in the state service", async () => {
        const stateSvcSetShouldTrustDeviceSpy = jest.spyOn(stateService, "setShouldTrustDevice");

        const newValue = true;
        await deviceTrustCryptoService.setShouldTrustDevice(newValue);

        expect(stateSvcSetShouldTrustDeviceSpy).toHaveBeenCalledTimes(1);
        expect(stateSvcSetShouldTrustDeviceSpy).toHaveBeenCalledWith(newValue);
      });
    });
  });

  describe("trustDeviceIfRequired", () => {
    it("should trust device and reset when getShouldTrustDevice returns true", async () => {
      jest.spyOn(deviceTrustCryptoService, "getShouldTrustDevice").mockResolvedValue(true);
      jest.spyOn(deviceTrustCryptoService, "trustDevice").mockResolvedValue({} as DeviceResponse);
      jest.spyOn(deviceTrustCryptoService, "setShouldTrustDevice").mockResolvedValue();

      await deviceTrustCryptoService.trustDeviceIfRequired();

      expect(deviceTrustCryptoService.getShouldTrustDevice).toHaveBeenCalledTimes(1);
      expect(deviceTrustCryptoService.trustDevice).toHaveBeenCalledTimes(1);
      expect(deviceTrustCryptoService.setShouldTrustDevice).toHaveBeenCalledWith(false);
    });

    it("should not trust device nor reset when getShouldTrustDevice returns false", async () => {
      const getShouldTrustDeviceSpy = jest
        .spyOn(deviceTrustCryptoService, "getShouldTrustDevice")
        .mockResolvedValue(false);
      const trustDeviceSpy = jest.spyOn(deviceTrustCryptoService, "trustDevice");
      const setShouldTrustDeviceSpy = jest.spyOn(deviceTrustCryptoService, "setShouldTrustDevice");

      await deviceTrustCryptoService.trustDeviceIfRequired();

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
      let stateSvcGetDeviceKeySpy: jest.SpyInstance;

      beforeEach(() => {
        existingDeviceKey = new SymmetricCryptoKey(
          new Uint8Array(deviceKeyBytesLength) as CsprngArray
        ) as DeviceKey;

        stateSvcGetDeviceKeySpy = jest.spyOn(stateService, "getDeviceKey");
      });

      it("returns null when there is not an existing device key", async () => {
        stateSvcGetDeviceKeySpy.mockResolvedValue(null);

        const deviceKey = await deviceTrustCryptoService.getDeviceKey();

        expect(stateSvcGetDeviceKeySpy).toHaveBeenCalledTimes(1);

        expect(deviceKey).toBeNull();
      });

      it("returns the device key when there is an existing device key", async () => {
        stateSvcGetDeviceKeySpy.mockResolvedValue(existingDeviceKey);

        const deviceKey = await deviceTrustCryptoService.getDeviceKey();

        expect(stateSvcGetDeviceKeySpy).toHaveBeenCalledTimes(1);

        expect(deviceKey).not.toBeNull();
        expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
        expect(deviceKey).toEqual(existingDeviceKey);
      });
    });

    describe("setDeviceKey", () => {
      it("sets the device key in the state service", async () => {
        const stateSvcSetDeviceKeySpy = jest.spyOn(stateService, "setDeviceKey");

        const deviceKey = new SymmetricCryptoKey(
          new Uint8Array(deviceKeyBytesLength) as CsprngArray
        ) as DeviceKey;

        // TypeScript will allow calling private methods if the object is of type 'any'
        // This is a hacky workaround, but it allows for cleaner tests
        await (deviceTrustCryptoService as any).setDeviceKey(deviceKey);

        expect(stateSvcSetDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(stateSvcSetDeviceKeySpy).toHaveBeenCalledWith(deviceKey);
      });
    });

    describe("makeDeviceKey", () => {
      it("creates a new non-null 64 byte device key, securely stores it, and returns it", async () => {
        const mockRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;

        const cryptoFuncSvcGenerateKeySpy = jest
          .spyOn(cryptoFunctionService, "aesGenerateKey")
          .mockResolvedValue(mockRandomBytes);

        // TypeScript will allow calling private methods if the object is of type 'any'
        // This is a hacky workaround, but it allows for cleaner tests
        const deviceKey = await (deviceTrustCryptoService as any).makeDeviceKey();

        expect(cryptoFuncSvcGenerateKeySpy).toHaveBeenCalledTimes(1);
        expect(cryptoFuncSvcGenerateKeySpy).toHaveBeenCalledWith(deviceKeyBytesLength * 8);

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
          "mockDevicePublicKeyEncryptedUserKey"
        );

        mockUserKeyEncryptedDevicePublicKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserKeyEncryptedDevicePublicKey"
        );

        mockDeviceKeyEncryptedDevicePrivateKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockDeviceKeyEncryptedDevicePrivateKey"
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
        const response = await deviceTrustCryptoService.trustDevice();

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
          mockDeviceKeyEncryptedDevicePrivateKey.encryptedString
        );

        expect(response).toBeInstanceOf(DeviceResponse);
        expect(response).toEqual(mockDeviceResponse);
      });

      it("throws specific error if user key is not found", async () => {
        // setup the spy to return null
        cryptoSvcGetUserKeySpy.mockResolvedValue(null);
        // check if the expected error is thrown
        await expect(deviceTrustCryptoService.trustDevice()).rejects.toThrow(
          "User symmetric key not found"
        );

        // reset the spy
        cryptoSvcGetUserKeySpy.mockReset();

        // setup the spy to return undefined
        cryptoSvcGetUserKeySpy.mockResolvedValue(undefined);
        // check if the expected error is thrown
        await expect(deviceTrustCryptoService.trustDevice()).rejects.toThrow(
          "User symmetric key not found"
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
            await expect(deviceTrustCryptoService.trustDevice()).rejects.toThrow(errorText);
          });

          test.each([null, undefined])(
            `throws an error if ${method} returns %s`,
            async (invalidValue) => {
              const methodSpy = spy();
              methodSpy.mockResolvedValue(invalidValue);
              await expect(deviceTrustCryptoService.trustDevice()).rejects.toThrow();
            }
          );
        }
      );
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
          "mockEncryptedDevicePrivateKey"
        );

        mockEncryptedUserKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockEncryptedUserKey"
        );

        jest.clearAllMocks();
      });

      it("returns null when device key isn't provided and isn't in state", async () => {
        const getDeviceKeySpy = jest
          .spyOn(deviceTrustCryptoService, "getDeviceKey")
          .mockResolvedValue(null);

        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey
        );

        expect(result).toBeNull();

        expect(getDeviceKeySpy).toHaveBeenCalledTimes(1);
      });

      it("successfully returns the user key when provided keys (including device key) can decrypt it", async () => {
        const decryptToBytesSpy = jest
          .spyOn(encryptService, "decryptToBytes")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));
        const rsaDecryptSpy = jest
          .spyOn(cryptoService, "rsaDecrypt")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));

        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey,
          mockDeviceKey
        );

        expect(result).toEqual(mockUserKey);
        expect(decryptToBytesSpy).toHaveBeenCalledTimes(1);
        expect(rsaDecryptSpy).toHaveBeenCalledTimes(1);
      });

      it("successfully returns the user key when a device key is not provided (retrieves device key from state)", async () => {
        const getDeviceKeySpy = jest
          .spyOn(deviceTrustCryptoService, "getDeviceKey")
          .mockResolvedValue(mockDeviceKey);

        const decryptToBytesSpy = jest
          .spyOn(encryptService, "decryptToBytes")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));
        const rsaDecryptSpy = jest
          .spyOn(cryptoService, "rsaDecrypt")
          .mockResolvedValue(new Uint8Array(userKeyBytesLength));

        // Call without providing a device key
        const result = await deviceTrustCryptoService.decryptUserKeyWithDeviceKey(
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey
        );

        expect(getDeviceKeySpy).toHaveBeenCalledTimes(1);

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
          mockEncryptedDevicePrivateKey,
          mockEncryptedUserKey,
          mockDeviceKey
        );

        expect(result).toBeNull();
        expect(decryptToBytesSpy).toHaveBeenCalledTimes(1);
        expect(setDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(setDeviceKeySpy).toHaveBeenCalledWith(null);
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
      });

      it("does an early exit when the current device is not a trusted device", async () => {
        stateService.getDeviceKey.mockResolvedValue(null);

        await deviceTrustCryptoService.rotateDevicesTrust(fakeNewUserKey, "");

        expect(devicesApiService.updateTrust).not.toBeCalled();
      });

      describe("is on a trusted device", () => {
        beforeEach(() => {
          stateService.getDeviceKey.mockResolvedValue(
            new SymmetricCryptoKey(new Uint8Array(deviceKeyBytesLength)) as DeviceKey
          );
        });

        it("rotates current device keys and calls api service when the current device is trusted", async () => {
          const currentEncryptedPublicKey = new EncString("2.cHVibGlj|cHVibGlj|cHVibGlj");
          const currentEncryptedUserKey = new EncString("4.dXNlcg==");

          const fakeOldUserKeyData = new Uint8Array(new Uint8Array(64));
          // Fill the first byte with something identifiable
          fakeOldUserKeyData.fill(FakeOldUserKeyMarker, 0, 1);

          // Mock the retrieval of a user key that differs from the new one passed into the method
          stateService.getUserKey.mockResolvedValue(
            new SymmetricCryptoKey(fakeOldUserKeyData) as UserKey
          );

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
              })
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
              new EncString("2.ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj")
            );
          });

          await deviceTrustCryptoService.rotateDevicesTrust(fakeNewUserKey, "my_password_hash");

          expect(devicesApiService.updateTrust).toBeCalledWith(
            matches((updateTrustModel: UpdateDevicesTrustRequest) => {
              return (
                updateTrustModel.currentDevice.encryptedPublicKey ===
                  "2.ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj|ZW5jcnlwdGVkcHVibGlj" &&
                updateTrustModel.currentDevice.encryptedUserKey === "4.ZW5jcnlwdGVkdXNlcg=="
              );
            })
          );
        });
      });
    });
  });
});
