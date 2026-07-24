import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../../spec";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { EncString } from "../crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../master-password/types/master-password.types";

import { DefaultChangeKdfService } from "./change-kdf.service";

describe("ChangeKdfService", () => {
  const sdkService = mock<SdkService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();

  let sut: DefaultChangeKdfService;

  const mockNewKdfConfig = new PBKDF2KdfConfig(200000);
  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockSalt = "test@bitwarden.com" as MasterPasswordSalt;
  const mockWrappedUserKey: EncString = makeEncString("wrappedUserKey");
  const mockUnlockData = new MasterPasswordUnlockData(
    mockSalt,
    mockNewKdfConfig,
    mockWrappedUserKey.encryptedString as MasterKeyWrappedUserKey,
  );

  const changeKdf = jest.fn();
  const mockRef = {
    value: {
      user_crypto_management: jest.fn().mockReturnValue({ change_kdf: changeKdf }),
    },
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  beforeEach(() => {
    sdkService.userClient$ = jest.fn(() => of(mockSdk)) as any;
    masterPasswordService.masterPasswordUnlockData$ = jest.fn(() => of(mockUnlockData)) as any;
    sut = new DefaultChangeKdfService(sdkService, masterPasswordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updateUserKdfParams", () => {
    it.each([
      ["masterPassword", null as unknown as string, mockNewKdfConfig, mockUserId],
      ["masterPassword", undefined as unknown as string, mockNewKdfConfig, mockUserId],
      ["kdf", "masterPassword", null as unknown as PBKDF2KdfConfig, mockUserId],
      ["kdf", "masterPassword", undefined as unknown as PBKDF2KdfConfig, mockUserId],
      ["userId", "masterPassword", mockNewKdfConfig, null as unknown as UserId],
      ["userId", "masterPassword", mockNewKdfConfig, undefined as unknown as UserId],
    ])("throws when %s is missing", async (name, password, kdf, userId) => {
      await expect(sut.updateUserKdfParams(password, kdf, userId)).rejects.toThrow(name);
    });

    it("throws when the SDK is not available", async () => {
      sdkService.userClient$ = jest.fn().mockReturnValue(of(null)) as any;

      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("SDK not available");
    });

    it("calls the SDK change_kdf with the password and new KDF config", async () => {
      await sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId);

      expect(changeKdf).toHaveBeenCalledWith("masterPassword", mockNewKdfConfig.toSdkConfig());
    });

    it("syncs the legacy master key and wrapped user key from the persisted unlock data", async () => {
      await sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId);

      expect(masterPasswordService.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
        "masterPassword",
        mockUnlockData,
        mockUserId,
      );
      expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString(mockWrappedUserKey.encryptedString),
        mockUserId,
      );
    });

    it("disposes the SDK reference", async () => {
      await sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId);

      expect(mockRef[Symbol.dispose]).toHaveBeenCalled();
    });

    it("propagates SDK errors", async () => {
      changeKdf.mockRejectedValueOnce(new Error("change_kdf failed"));

      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("change_kdf failed");
    });
  });
});
