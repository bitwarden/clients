import { mock, mockReset } from "jest-mock-extended";

import { DevicesApiServiceAbstraction } from "../abstractions/devices/devices-api.service.abstraction";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { EncryptionType } from "../enums/encryption-type.enum";
import { AppIdService } from "../platform/abstractions/app-id.service";
import { CryptoFunctionService } from "../platform/abstractions/crypto-function.service";
import { EncryptService } from "../platform/abstractions/encrypt.service";
import { StateService } from "../platform/abstractions/state.service";
import { EncString } from "../platform/models/domain/enc-string";
import { SymmetricCryptoKey, DeviceKey } from "../platform/models/domain/symmetric-crypto-key";
import { CryptoService } from "../platform/services/crypto.service";
import { CsprngArray } from "../types/csprng";

import { DeviceCryptoService } from "./device-crypto.service.implementation";

describe("deviceCryptoService", () => {
  let deviceCryptoService: DeviceCryptoService;

  const cryptoFunctionService = mock<CryptoFunctionService>();
  const cryptoService = mock<CryptoService>();
  const encryptService = mock<EncryptService>();
  const stateService = mock<StateService>();
  const appIdService = mock<AppIdService>();
  const devicesApiService = mock<DevicesApiServiceAbstraction>();

  beforeEach(() => {
    mockReset(cryptoFunctionService);
    mockReset(encryptService);
    mockReset(stateService);
    mockReset(appIdService);
    mockReset(devicesApiService);

    deviceCryptoService = new DeviceCryptoService(
      cryptoFunctionService,
      cryptoService,
      encryptService,
      stateService,
      appIdService,
      devicesApiService
    );
  });

  it("instantiates", () => {
    expect(deviceCryptoService).not.toBeFalsy();
  });

  describe("Trusted Device Encryption", () => {
    const deviceKeyBytesLength = 64;
    const userSymKeyBytesLength = 64;

    describe("getDeviceKey", () => {
      let mockRandomBytes: CsprngArray;
      let mockDeviceKey: SymmetricCryptoKey;
      let existingDeviceKey: DeviceKey;
      let stateSvcGetDeviceKeySpy: jest.SpyInstance;
      let makeDeviceKeySpy: jest.SpyInstance;

      beforeEach(() => {
        mockRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;
        mockDeviceKey = new SymmetricCryptoKey(mockRandomBytes);
        existingDeviceKey = new SymmetricCryptoKey(
          new Uint8Array(deviceKeyBytesLength) as CsprngArray
        ) as DeviceKey;

        stateSvcGetDeviceKeySpy = jest.spyOn(stateService, "getDeviceKey");
        makeDeviceKeySpy = jest.spyOn(deviceCryptoService as any, "makeDeviceKey");
      });

      it("gets a device key when there is not an existing device key", async () => {
        stateSvcGetDeviceKeySpy.mockResolvedValue(null);
        makeDeviceKeySpy.mockResolvedValue(mockDeviceKey);

        const deviceKey = await deviceCryptoService.getDeviceKey();

        expect(stateSvcGetDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(makeDeviceKeySpy).toHaveBeenCalledTimes(1);

        expect(deviceKey).not.toBeNull();
        expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
        expect(deviceKey).toEqual(mockDeviceKey);
      });

      it("returns the existing device key without creating a new one when there is an existing device key", async () => {
        stateSvcGetDeviceKeySpy.mockResolvedValue(existingDeviceKey);

        const deviceKey = await deviceCryptoService.getDeviceKey();

        expect(stateSvcGetDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(makeDeviceKeySpy).not.toHaveBeenCalled();

        expect(deviceKey).not.toBeNull();
        expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);
        expect(deviceKey).toEqual(existingDeviceKey);
      });
    });

    describe("makeDeviceKey", () => {
      it("creates a new non-null 64 byte device key, securely stores it, and returns it", async () => {
        const mockRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;

        const cryptoFuncSvcRandomBytesSpy = jest
          .spyOn(cryptoFunctionService, "randomBytes")
          .mockResolvedValue(mockRandomBytes);

        const stateSvcSetDeviceKeySpy = jest.spyOn(stateService, "setDeviceKey");

        // TypeScript will allow calling private methods if the object is of type 'any'
        // This is a hacky workaround, but it allows for cleaner tests
        const deviceKey = await (deviceCryptoService as any).makeDeviceKey();

        expect(cryptoFuncSvcRandomBytesSpy).toHaveBeenCalledTimes(1);
        expect(cryptoFuncSvcRandomBytesSpy).toHaveBeenCalledWith(deviceKeyBytesLength);

        expect(deviceKey).not.toBeNull();
        expect(deviceKey).toBeInstanceOf(SymmetricCryptoKey);

        expect(stateSvcSetDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(stateSvcSetDeviceKeySpy).toHaveBeenCalledWith(deviceKey);
      });
    });

    describe("trustDevice", () => {
      let mockDeviceKeyRandomBytes: CsprngArray;
      let mockDeviceKey: DeviceKey;

      let mockUserSymKeyRandomBytes: CsprngArray;
      let mockUserSymKey: SymmetricCryptoKey;

      const deviceRsaKeyLength = 2048;
      let mockDeviceRsaKeyPair: [Uint8Array, Uint8Array];
      let mockDevicePrivateKey: Uint8Array;
      let mockDevicePublicKey: Uint8Array;
      let mockDevicePublicKeyEncryptedUserSymKey: EncString;
      let mockUserSymKeyEncryptedDevicePublicKey: EncString;
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
      let cryptoSvcGetEncKeySpy: jest.SpyInstance;
      let cryptoSvcRsaEncryptSpy: jest.SpyInstance;
      let encryptServiceEncryptSpy: jest.SpyInstance;
      let appIdServiceGetAppIdSpy: jest.SpyInstance;
      let devicesApiServiceUpdateTrustedDeviceKeysSpy: jest.SpyInstance;

      beforeEach(() => {
        // Setup all spies and default return values for the happy path

        mockDeviceKeyRandomBytes = new Uint8Array(deviceKeyBytesLength) as CsprngArray;
        mockDeviceKey = new SymmetricCryptoKey(mockDeviceKeyRandomBytes) as DeviceKey;

        mockUserSymKeyRandomBytes = new Uint8Array(userSymKeyBytesLength) as CsprngArray;
        mockUserSymKey = new SymmetricCryptoKey(mockUserSymKeyRandomBytes);

        mockDeviceRsaKeyPair = [
          new Uint8Array(deviceRsaKeyLength),
          new Uint8Array(deviceRsaKeyLength),
        ];

        mockDevicePublicKey = mockDeviceRsaKeyPair[0];
        mockDevicePrivateKey = mockDeviceRsaKeyPair[1];

        mockDevicePublicKeyEncryptedUserSymKey = new EncString(
          EncryptionType.Rsa2048_OaepSha1_B64,
          "mockDevicePublicKeyEncryptedUserSymKey"
        );

        mockUserSymKeyEncryptedDevicePublicKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserSymKeyEncryptedDevicePublicKey"
        );

        mockDeviceKeyEncryptedDevicePrivateKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockDeviceKeyEncryptedDevicePrivateKey"
        );

        // TypeScript will allow calling private methods if the object is of type 'any'
        makeDeviceKeySpy = jest
          .spyOn(deviceCryptoService as any, "makeDeviceKey")
          .mockResolvedValue(mockDeviceKey);

        rsaGenerateKeyPairSpy = jest
          .spyOn(cryptoFunctionService, "rsaGenerateKeyPair")
          .mockResolvedValue(mockDeviceRsaKeyPair);

        cryptoSvcGetEncKeySpy = jest
          .spyOn(cryptoService, "getEncKey")
          .mockResolvedValue(mockUserSymKey);

        cryptoSvcRsaEncryptSpy = jest
          .spyOn(cryptoService, "rsaEncrypt")
          .mockResolvedValue(mockDevicePublicKeyEncryptedUserSymKey);

        encryptServiceEncryptSpy = jest
          .spyOn(encryptService, "encrypt")
          .mockImplementation((plainValue, key) => {
            if (plainValue === mockDevicePublicKey && key === mockUserSymKey) {
              return Promise.resolve(mockUserSymKeyEncryptedDevicePublicKey);
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
        const response = await deviceCryptoService.trustDevice();

        expect(makeDeviceKeySpy).toHaveBeenCalledTimes(1);
        expect(rsaGenerateKeyPairSpy).toHaveBeenCalledTimes(1);
        expect(cryptoSvcGetEncKeySpy).toHaveBeenCalledTimes(1);

        expect(cryptoSvcRsaEncryptSpy).toHaveBeenCalledTimes(1);
        expect(encryptServiceEncryptSpy).toHaveBeenCalledTimes(2);

        expect(appIdServiceGetAppIdSpy).toHaveBeenCalledTimes(1);
        expect(devicesApiServiceUpdateTrustedDeviceKeysSpy).toHaveBeenCalledTimes(1);
        expect(devicesApiServiceUpdateTrustedDeviceKeysSpy).toHaveBeenCalledWith(
          mockDeviceId,
          mockDevicePublicKeyEncryptedUserSymKey.encryptedString,
          mockUserSymKeyEncryptedDevicePublicKey.encryptedString,
          mockDeviceKeyEncryptedDevicePrivateKey.encryptedString
        );

        expect(response).toBeInstanceOf(DeviceResponse);
        expect(response).toEqual(mockDeviceResponse);
      });

      it("throws specific error if user symmetric key is not found", async () => {
        // setup the spy to return null
        cryptoSvcGetEncKeySpy.mockResolvedValue(null);
        // check if the expected error is thrown
        await expect(deviceCryptoService.trustDevice()).rejects.toThrow(
          "User symmetric key not found"
        );

        // reset the spy
        cryptoSvcGetEncKeySpy.mockReset();

        // setup the spy to return undefined
        cryptoSvcGetEncKeySpy.mockResolvedValue(undefined);
        // check if the expected error is thrown
        await expect(deviceCryptoService.trustDevice()).rejects.toThrow(
          "User symmetric key not found"
        );
      });

      const methodsToTestForErrorsOrInvalidReturns = [
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
          method: "getEncKey",
          spy: () => cryptoSvcGetEncKeySpy,
          errorText: "getEncKey error",
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
            await expect(deviceCryptoService.trustDevice()).rejects.toThrow(errorText);
          });

          test.each([null, undefined])(
            `throws an error if ${method} returns %s`,
            async (invalidValue) => {
              const methodSpy = spy();
              methodSpy.mockResolvedValue(invalidValue);
              await expect(deviceCryptoService.trustDevice()).rejects.toThrow();
            }
          );
        }
      );
    });
  });
});
