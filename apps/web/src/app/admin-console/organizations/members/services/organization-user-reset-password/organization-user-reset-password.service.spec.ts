// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordDetailsResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, OrgKey, MasterKey } from "@bitwarden/common/types/key";
import { KdfType, KeyService } from "@bitwarden/key-management";

import { OrganizationUserResetPasswordService } from "./organization-user-reset-password.service";

describe("OrganizationUserResetPasswordService", () => {
  let sut: OrganizationUserResetPasswordService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let organizationService: MockProxy<OrganizationService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationApiService: MockProxy<OrganizationApiService>;
  let i18nService: MockProxy<I18nService>;

  beforeAll(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    organizationService = mock<OrganizationService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationApiService = mock<OrganizationApiService>();
    i18nService = mock<I18nService>();

    sut = new OrganizationUserResetPasswordService(
      keyService,
      encryptService,
      organizationService,
      organizationUserApiService,
      organizationApiService,
      i18nService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should be created", () => {
    expect(sut).toBeTruthy();
  });

  describe("getRecoveryKey", () => {
    const mockOrgId = "test-org-id";

    beforeEach(() => {
      organizationApiService.getKeys.mockResolvedValue(
        new OrganizationKeysResponse({
          privateKey: "test-private-key",
          publicKey: "test-public-key",
        }),
      );

      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      keyService.getUserKey.mockResolvedValue(mockUserKey);

      encryptService.rsaEncrypt.mockResolvedValue(
        new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "mockEncryptedUserKey"),
      );
    });

    it("should return an encrypted user key", async () => {
      const encryptedString = await sut.buildRecoveryKey(mockOrgId);
      expect(encryptedString).toBeDefined();
    });

    it("should only use the user key from memory if one is not provided", async () => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      await sut.buildRecoveryKey(mockOrgId, mockUserKey);

      expect(keyService.getUserKey).not.toHaveBeenCalled();
    });

    it("should throw an error if the organization keys are null", async () => {
      organizationApiService.getKeys.mockResolvedValue(null);
      await expect(sut.buildRecoveryKey(mockOrgId)).rejects.toThrow();
    });

    it("should throw an error if the user key can't be found", async () => {
      keyService.getUserKey.mockResolvedValue(null);
      await expect(sut.buildRecoveryKey(mockOrgId)).rejects.toThrow();
    });

    it("should rsa encrypt the user key", async () => {
      await sut.buildRecoveryKey(mockOrgId);

      expect(encryptService.rsaEncrypt).toHaveBeenCalledWith(expect.anything(), expect.anything());
    });
  });

  describe("resetMasterPassword", () => {
    const mockNewMP = "new-password";
    const mockEmail = "test@example.com";
    const mockOrgUserId = "test-org-user-id";
    const mockOrgId = "test-org-id";

    beforeEach(() => {
      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
        new OrganizationUserResetPasswordDetailsResponse({
          kdf: KdfType.PBKDF2_SHA256,
          kdfIterations: 5000,
          resetPasswordKey: "test-reset-password-key",
          encryptedPrivateKey: "test-encrypted-private-key",
        }),
      );

      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockOrgKey = new SymmetricCryptoKey(mockRandomBytes) as OrgKey;
      keyService.getOrgKey.mockResolvedValue(mockOrgKey);
      encryptService.decryptToBytes.mockResolvedValue(mockRandomBytes);

      encryptService.rsaDecrypt.mockResolvedValue(mockRandomBytes);
      const mockMasterKey = new SymmetricCryptoKey(mockRandomBytes) as MasterKey;
      keyService.makeMasterKey.mockResolvedValue(mockMasterKey);
      keyService.hashMasterKey.mockResolvedValue("test-master-key-hash");

      const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      keyService.encryptUserKeyWithMasterKey.mockResolvedValue([
        mockUserKey,
        new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "test-encrypted-user-key"),
      ]);
    });

    it("should reset the user's master password", async () => {
      await sut.resetMasterPassword(mockNewMP, mockEmail, mockOrgUserId, mockOrgId);
      expect(organizationUserApiService.putOrganizationUserResetPassword).toHaveBeenCalled();
    });

    it("should throw an error if the user details are null", async () => {
      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(null);
      await expect(
        sut.resetMasterPassword(mockNewMP, mockEmail, mockOrgUserId, mockOrgId),
      ).rejects.toThrow();
    });

    it("should throw an error if the org key is null", async () => {
      keyService.getOrgKey.mockResolvedValue(null);
      await expect(
        sut.resetMasterPassword(mockNewMP, mockEmail, mockOrgUserId, mockOrgId),
      ).rejects.toThrow();
    });
  });

  describe("getRotatedData", () => {
    beforeEach(() => {
      organizationService.organizations$.mockReturnValue(
        of([createOrganization("1", "org1"), createOrganization("2", "org2")]),
      );
      organizationApiService.getKeys.mockResolvedValue(
        new OrganizationKeysResponse({
          privateKey: "test-private-key",
          publicKey: "test-public-key",
        }),
      );
      encryptService.rsaEncrypt.mockResolvedValue(
        new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "mockEncryptedUserKey"),
      );
    });

    it("should return all re-encrypted account recovery keys", async () => {
      const result = await sut.getRotatedData(
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        "mockUserId" as UserId,
      );

      expect(result).toHaveLength(2);
    });

    it("throws if the new user key is null", async () => {
      await expect(
        sut.getRotatedData(
          new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
          null,
          "mockUserId" as UserId,
        ),
      ).rejects.toThrow("New user key is required for rotation.");
    });
  });
});

function createOrganization(id: string, name: string) {
  const org = new Organization();
  org.id = id;
  org.name = name;
  org.identifier = name;
  org.isMember = true;
  org.resetPasswordEnrolled = true;
  return org;
}
