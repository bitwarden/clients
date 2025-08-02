import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../../../spec";
import { EncString } from "../../crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
} from "../../master-password/types/master-password.types";

import { ChangeKdfService } from "./change-kdf-service";

describe("ChangeKdfService", () => {
  const apiService = mock<ApiService>();
  const masterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const keyService = mock<KeyService>();
  const kdfConfigService = mock<KdfConfigService>();

  let sut: ChangeKdfService = mock<ChangeKdfService>();

  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockOldKdfConfig = new PBKDF2KdfConfig(100000);
  const mockNewKdfConfig = new PBKDF2KdfConfig(200000);
  const mockOldHash = "oldHash" as MasterPasswordAuthenticationHash;
  const mockNewHash = "newHash" as MasterPasswordAuthenticationHash;
  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockSalt = "test@bitwarden.com" as MasterPasswordSalt;
  const mockWrappedUserKey: EncString = makeEncString("wrappedUserKey");

  beforeEach(() => {
    sut = new ChangeKdfService(apiService, masterPasswordService, keyService, kdfConfigService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("updateUserKdfParams", () => {
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

      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValueOnce({
        kdf: mockNewKdfConfig,
        salt: mockSalt,
        masterKeyWrappedUserKey: mockWrappedUserKey.encryptedString as MasterKeyWrappedUserKey,
      });

      await sut.updateUserKdfParams("masterPassword", mockNewKdfConfig, mockUserId);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/accounts/kdf",
        expect.any(KdfRequest),
        true,
        false,
      );
    });
  });
});
