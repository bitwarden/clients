import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../../spec";
import { KdfRequest } from "../../models/request/kdf.request";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { EncString } from "../crypto/models/enc-string";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../master-password/types/master-password.types";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";
import { DefaultChangeKdfService } from "./change-kdf-service";

describe("ChangeKdfService", () => {
  const changeKdfApiService = mock<ChangeKdfApiService>();
  const sdkService = mock<SdkService>();

  let sut: DefaultChangeKdfService;

  const mockNewKdfConfig = new PBKDF2KdfConfig(200000);
  const mockOldKdfConfig = new PBKDF2KdfConfig(100000);
  const mockOldHash = "oldHash" as MasterPasswordAuthenticationHash;
  const mockNewHash = "newHash" as MasterPasswordAuthenticationHash;
  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockSalt = "test@bitwarden.com" as MasterPasswordSalt;
  const mockWrappedUserKey: EncString = makeEncString("wrappedUserKey");

  const mockSdkClient = {
    crypto: jest.fn().mockReturnValue({
      make_update_kdf: jest.fn(),
    }),
  };
  const mockRef = {
    value: mockSdkClient,
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  beforeEach(() => {
    sdkService.userClient$ = jest.fn((userId: UserId) => of(mockSdk)) as any;
    sut = new DefaultChangeKdfService(changeKdfApiService, sdkService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updateUserKdfParams", () => {
    const mockUpdateKdfResult = {
      masterPasswordAuthenticationData: {
        kdf: mockNewKdfConfig.toSdkConfig(),
        salt: mockSalt,
        masterPasswordAuthenticationHash: mockNewHash,
      },
      masterPasswordUnlockData: {
        kdf: mockNewKdfConfig.toSdkConfig(),
        salt: mockSalt,
        masterKeyWrappedUserKey: mockWrappedUserKey.encryptedString,
      },
      oldMasterPasswordAuthenticationData: {
        kdf: mockOldKdfConfig.toSdkConfig(),
        salt: mockSalt,
        masterPasswordAuthenticationHash: mockOldHash,
      },
    };

    beforeEach(() => {
      mockSdkClient.crypto().make_update_kdf.mockReturnValue(mockUpdateKdfResult);
    });

    it("should throw an error if masterPassword is null", async () => {
      await expect(
        sut.updateUserKdfParams(null as unknown as string, mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("masterPassword");
    });

    it("should throw an error if masterPassword is undefined", async () => {
      await expect(
        sut.updateUserKdfParams(undefined as unknown as string, mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("masterPassword");
    });

    it("should throw an error if kdf is null", async () => {
      await expect(
        sut.updateUserKdfParams("masterPassword", null as unknown as PBKDF2KdfConfig, mockUserId),
      ).rejects.toThrow("kdf");
    });

    it("should throw an error if kdf is undefined", async () => {
      await expect(
        sut.updateUserKdfParams(
          "masterPassword",
          undefined as unknown as PBKDF2KdfConfig,
          mockUserId,
        ),
      ).rejects.toThrow("kdf");
    });

    it("should throw an error if userId is null", async () => {
      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, null as unknown as UserId),
      ).rejects.toThrow("userId");
    });

    it("should throw an error if userId is undefined", async () => {
      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, undefined as unknown as UserId),
      ).rejects.toThrow("userId");
    });

    it("should throw an error if SDK is not available", async () => {
      sdkService.userClient$ = jest.fn().mockReturnValue(of(null)) as any;

      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("SDK not available");
    });

    it("should call SDK update_kdf with correct parameters", async () => {
      const masterPassword = "masterPassword";

      await sut.updateUserKdfParams(masterPassword, mockNewKdfConfig, mockUserId);

      expect(mockSdkClient.crypto().make_update_kdf).toHaveBeenCalledWith(
        masterPassword,
        mockNewKdfConfig.toSdkConfig(),
      );
    });

    it("should call changeKdfApiService.updateUserKdfParams with correct request", async () => {
      const masterPassword = "masterPassword";

      await sut.updateUserKdfParams(masterPassword, mockNewKdfConfig, mockUserId);

      const expectedRequest = new KdfRequest(
        {
          salt: mockSalt,
          kdf: mockNewKdfConfig,
          masterPasswordAuthenticationHash: mockNewHash,
        },
        new MasterPasswordUnlockData(
          mockSalt,
          mockNewKdfConfig,
          mockWrappedUserKey.encryptedString as MasterKeyWrappedUserKey,
        ),
      );
      expectedRequest.authenticateWith({
        salt: mockSalt,
        kdf: mockOldKdfConfig,
        masterPasswordAuthenticationHash: mockOldHash,
      });

      expect(changeKdfApiService.updateUserKdfParams).toHaveBeenCalledWith(expectedRequest);
    });

    it("should properly dispose of SDK resources", async () => {
      const masterPassword = "masterPassword";
      jest.spyOn(mockNewKdfConfig, "toSdkConfig").mockReturnValue({} as any);

      await sut.updateUserKdfParams(masterPassword, mockNewKdfConfig, mockUserId);

      expect(mockRef[Symbol.dispose]).toHaveBeenCalled();
    });

    it("should handle SDK errors properly", async () => {
      const masterPassword = "masterPassword";
      const sdkError = new Error("SDK update_kdf failed");
      jest.spyOn(mockNewKdfConfig, "toSdkConfig").mockReturnValue({} as any);
      mockSdkClient.crypto().make_update_kdf.mockImplementation(() => {
        throw sdkError;
      });

      await expect(
        sut.updateUserKdfParams(masterPassword, mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("SDK update_kdf failed");
    });
  });
});
