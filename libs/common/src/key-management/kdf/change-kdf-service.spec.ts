import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";
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
  const masterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const keyService = mock<KeyService>();
  const kdfConfigService = mock<KdfConfigService>();

  let sut: DefaultChangeKdfService = mock<DefaultChangeKdfService>();

  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockOldKdfConfig = new PBKDF2KdfConfig(100000);
  const mockNewKdfConfig = new PBKDF2KdfConfig(200000);
  const mockOldHash = "oldHash" as MasterPasswordAuthenticationHash;
  const mockNewHash = "newHash" as MasterPasswordAuthenticationHash;
  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockSalt = "test@bitwarden.com" as MasterPasswordSalt;
  const mockWrappedUserKey = "wrappedUserKey";

  beforeEach(() => {
    sut = new DefaultChangeKdfService(
      masterPasswordService,
      keyService,
      kdfConfigService,
      changeKdfApiService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("updateUserKdfParams", () => {
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

    it("should throw an error if userKey is null", async () => {
      keyService.userKey$.mockReturnValueOnce(of(null));
      masterPasswordService.saltForUser$.mockReturnValueOnce(of(mockSalt));
      kdfConfigService.getKdfConfig$.mockReturnValueOnce(of(mockOldKdfConfig));
      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow();
    });

    it("should throw an error if salt is null", async () => {
      keyService.userKey$.mockReturnValueOnce(of(mockUserKey));
      masterPasswordService.saltForUser$.mockReturnValueOnce(of(null));
      kdfConfigService.getKdfConfig$.mockReturnValueOnce(of(mockOldKdfConfig));
      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("Failed to get salt");
    });

    it("should throw an error if oldKdfConfig is null", async () => {
      keyService.userKey$.mockReturnValueOnce(of(mockUserKey));
      masterPasswordService.saltForUser$.mockReturnValueOnce(of(mockSalt));
      kdfConfigService.getKdfConfig$.mockReturnValueOnce(of(null));
      await expect(
        sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId),
      ).rejects.toThrow("Failed to get oldKdfConfig");
    });

    it("should call apiService.send with correct parameters", async () => {
      keyService.userKey$.mockReturnValueOnce(of(mockUserKey));
      masterPasswordService.saltForUser$.mockReturnValueOnce(of(mockSalt));
      kdfConfigService.getKdfConfig$.mockReturnValueOnce(of(mockOldKdfConfig));

      masterPasswordService.makeMasterPasswordAuthenticationData
        .mockResolvedValueOnce({
          salt: mockSalt,
          kdf: mockOldKdfConfig,
          masterPasswordAuthenticationHash: mockOldHash,
        })
        .mockResolvedValueOnce({
          salt: mockSalt,
          kdf: mockNewKdfConfig,
          masterPasswordAuthenticationHash: mockNewHash,
        });

      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValueOnce(
        new MasterPasswordUnlockData(
          mockSalt,
          mockNewKdfConfig,
          mockWrappedUserKey as MasterKeyWrappedUserKey,
        ),
      );

      await sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId);

      const expected = new KdfRequest(
        {
          salt: mockSalt,
          kdf: mockNewKdfConfig,
          masterPasswordAuthenticationHash: mockNewHash,
        },
        new MasterPasswordUnlockData(
          mockSalt,
          mockNewKdfConfig,
          mockWrappedUserKey as MasterKeyWrappedUserKey,
        ),
      ).authenticateWith({
        salt: mockSalt,
        kdf: mockOldKdfConfig,
        masterPasswordAuthenticationHash: mockOldHash,
      });

      expect(changeKdfApiService.updateUserKdfParams).toHaveBeenCalledWith(expected);
    });
  });
});
