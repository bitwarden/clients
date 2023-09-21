import { mock, mockReset } from "jest-mock-extended";

import { CsprngArray } from "../../types/csprng";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { EncString } from "../models/domain/enc-string";
import {
  MasterKey,
  PinKey,
  SymmetricCryptoKey,
  UserKey,
} from "../models/domain/symmetric-crypto-key";
import { CryptoService } from "../services/crypto.service";

describe("cryptoService", () => {
  let cryptoService: CryptoService;

  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();

  const mockUserId = "mock user id";

  beforeEach(() => {
    mockReset(cryptoFunctionService);
    mockReset(encryptService);
    mockReset(platformUtilService);
    mockReset(logService);
    mockReset(stateService);

    cryptoService = new CryptoService(
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService
    );
  });

  it("instantiates", () => {
    expect(cryptoService).not.toBeFalsy();
  });

  describe("getUserKey", () => {
    let mockUserKey: UserKey;
    let stateSvcGetUserKey: jest.SpyInstance;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      stateSvcGetUserKey = jest.spyOn(stateService, "getUserKey");
    });

    it("returns the User Key if available", async () => {
      stateSvcGetUserKey.mockResolvedValue(mockUserKey);

      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(stateSvcGetUserKey).toHaveBeenCalledWith({ userId: mockUserId });
      expect(userKey).toEqual(mockUserKey);
    });

    it("sets the Auto key if the User Key if not set", async () => {
      const autoKeyB64 =
        "IT5cA1i5Hncd953pb00E58D2FqJX+fWTj4AvoI67qkGHSQPgulAqKv+LaKRAo9Bg0xzP9Nw00wk4TqjMmGSM+g==";
      stateService.getUserKeyAutoUnlock.mockResolvedValue(autoKeyB64);

      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(stateService.setUserKey).toHaveBeenCalledWith(expect.any(SymmetricCryptoKey), {
        userId: mockUserId,
      });
      expect(userKey.keyB64).toEqual(autoKeyB64);
    });
  });

  describe("getUserKeyWithLegacySupport", () => {
    let mockUserKey: UserKey;
    let mockMasterKey: MasterKey;
    let stateSvcGetUserKey: jest.SpyInstance;
    let stateSvcGetMasterKey: jest.SpyInstance;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      stateSvcGetUserKey = jest.spyOn(stateService, "getUserKey");
      stateSvcGetMasterKey = jest.spyOn(stateService, "getMasterKey");
    });

    it("returns the User Key if available", async () => {
      stateSvcGetUserKey.mockResolvedValue(mockUserKey);

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(stateSvcGetUserKey).toHaveBeenCalledWith({ userId: mockUserId });
      expect(stateSvcGetMasterKey).not.toHaveBeenCalled();

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns the user's master key when User Key is not available", async () => {
      stateSvcGetUserKey.mockResolvedValue(null);
      stateSvcGetMasterKey.mockResolvedValue(mockMasterKey);

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(stateSvcGetMasterKey).toHaveBeenCalledWith({ userId: mockUserId });
      expect(userKey).toEqual(mockMasterKey);
    });
  });

  describe("setUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    describe("Auto Key refresh", () => {
      it("sets an Auto key if vault timeout is set to null", async () => {
        stateService.getVaultTimeout.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.keyB64, {
          userId: mockUserId,
        });
      });

      it("clears the Auto key if vault timeout is set to anything other than null", async () => {
        stateService.getVaultTimeout.mockResolvedValue(10);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });

      it("clears the old deprecated Auto key whenever a User Key is set", async () => {
        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setCryptoMasterKeyAuto).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });

    describe("Pin Key refresh", () => {
      let cryptoSvcMakePinKey: jest.SpyInstance;
      const protectedPin =
        "2.jcow2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=";
      let encPin: EncString;

      beforeEach(() => {
        cryptoSvcMakePinKey = jest.spyOn(cryptoService, "makePinKey");
        cryptoSvcMakePinKey.mockResolvedValue(new SymmetricCryptoKey(new Uint8Array(64)) as PinKey);
        encPin = new EncString(
          "2.jcow2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg="
        );
        encryptService.encrypt.mockResolvedValue(encPin);
      });

      it("sets a UserKeyPin if a ProtectedPin and UserKeyPin is set", async () => {
        stateService.getProtectedPin.mockResolvedValue(protectedPin);
        stateService.getPinKeyEncryptedUserKey.mockResolvedValue(
          new EncString(
            "2.OdGNE3L23GaDZGvu9h2Brw==|/OAcNnrYwu0rjiv8+RUr3Tc+Ef8fV035Tm1rbTxfEuC+2LZtiCAoIvHIZCrM/V1PWnb/pHO2gh9+Koks04YhX8K29ED4FzjeYP8+YQD/dWo=|+12xTcIK/UVRsOyawYudPMHb6+lCHeR2Peq1pQhPm0A="
          )
        );

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKey).toHaveBeenCalledWith(expect.any(EncString), {
          userId: mockUserId,
        });
      });

      it("sets a PinKeyEphemeral if a ProtectedPin is set, but a UserKeyPin is not set", async () => {
        stateService.getProtectedPin.mockResolvedValue(protectedPin);
        stateService.getPinKeyEncryptedUserKey.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(
          expect.any(EncString),
          {
            userId: mockUserId,
          }
        );
      });

      it("clears the UserKeyPin and UserKeyPinEphemeral if the ProtectedPin is not set", async () => {
        stateService.getProtectedPin.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKey).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
        expect(stateService.setPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });
  });
});
