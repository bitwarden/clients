// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordDetailsResponse,
  OrganizationUserResetPasswordRequest,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey, OrgKey, MasterKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KdfConfig, KdfType, KeyService } from "@bitwarden/key-management";

import { OrganizationUserResetPasswordService } from "./organization-user-reset-password.service";

const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
const mockPublicKeys = [Utils.fromUtf8ToArray("test-public-key")];

describe("OrganizationUserResetPasswordService", () => {
  let sut: OrganizationUserResetPasswordService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let organizationService: MockProxy<OrganizationService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationApiService: MockProxy<OrganizationApiService>;
  let i18nService: MockProxy<I18nService>;
  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let configService: MockProxy<ConfigService>;

  beforeAll(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    organizationService = mock<OrganizationService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationApiService = mock<OrganizationApiService>();
    i18nService = mock<I18nService>();
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    configService = mock<ConfigService>();

    sut = new OrganizationUserResetPasswordService(
      keyService,
      encryptService,
      organizationService,
      organizationUserApiService,
      organizationApiService,
      i18nService,
      accountService,
      masterPasswordService,
      configService,
    );
  });

  beforeEach(() => {
    organizationService.organizations$.mockReturnValue(
      new BehaviorSubject([
        createOrganization("1", "org1", true),
        createOrganization("2", "org2", false),
      ]),
    );
    organizationApiService.getKeys.mockResolvedValue(
      new OrganizationKeysResponse({
        privateKey: "privateKey",
        publicKey: "publicKey",
      }),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should be created", () => {
    expect(sut).toBeTruthy();
  });

  describe("buildRecoveryKey", () => {
    const mockOrgId = "test-org-id";

    beforeEach(() => {
      organizationApiService.getKeys.mockResolvedValue(
        new OrganizationKeysResponse({
          privateKey: "test-private-key",
          publicKey: Utils.fromUtf8ToArray("test-public-key"),
        }),
      );

      encryptService.encapsulateKeyUnsigned.mockResolvedValue(
        new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "mockEncryptedUserKey"),
      );
    });

    it("should return an encrypted user key", async () => {
      const encryptedString = await sut.buildRecoveryKey(mockOrgId, mockUserKey, mockPublicKeys);
      expect(encryptedString).toBeDefined();
    });

    it("should throw an error if the organization keys are null", async () => {
      organizationApiService.getKeys.mockResolvedValue(null);
      await expect(sut.buildRecoveryKey(mockOrgId, mockUserKey, mockPublicKeys)).rejects.toThrow();
    });

    it("should throw an error if the user key can't be found", async () => {
      keyService.getUserKey.mockResolvedValue(null);
      await expect(sut.buildRecoveryKey(mockOrgId, null, mockPublicKeys)).rejects.toThrow();
    });

    it("should rsa encrypt the user key", async () => {
      await sut.buildRecoveryKey(mockOrgId, mockUserKey, mockPublicKeys);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });

    it("should throw an error if the public key is not trusted", async () => {
      await expect(
        sut.buildRecoveryKey(mockOrgId, mockUserKey, [new Uint8Array(64)]),
      ).rejects.toThrow();
    });
  });

  /**
   * @deprecated This 'describe' to be removed in PM-28143. When you remove this, check also if there are
   * any imports/properties in the test setup above that are now un-used and can also be removed.
   */
  describe("resetMasterPassword [PM27086_UpdateAuthenticationApisForInputPassword flag DISABLED]", () => {
    const PM27086_UpdateAuthenticationApisForInputPasswordFlagEnabled = false;

    const mockNewMP = "new-password";
    const mockEmail = "test@example.com";
    const mockOrgUserId = "test-org-user-id";
    const mockOrgId = "test-org-id";

    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(
        PM27086_UpdateAuthenticationApisForInputPasswordFlagEnabled,
      );

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
      keyService.orgKeys$.mockReturnValue(
        of({ [mockOrgId]: mockOrgKey } as Record<OrganizationId, OrgKey>),
      );

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
      keyService.orgKeys$.mockReturnValue(of(null));
      await expect(
        sut.resetMasterPassword(mockNewMP, mockEmail, mockOrgUserId, mockOrgId),
      ).rejects.toThrow();
    });
  });

  describe("resetMasterPassword [PM27086_UpdateAuthenticationApisForInputPassword flag ENABLED]", () => {
    // Mock sut method parameters
    const newMasterPassword = "new-master-password";
    const email = "user@example.com";
    const orgUserId = "org-user-id";
    const orgId = "org-id" as OrganizationId;

    // Mock feature flag value
    const PM27086_UpdateAuthenticationApisForInputPasswordFlagEnabled = true;

    // Mock method data
    let organizationUserResetPasswordDetailsResponse: OrganizationUserResetPasswordDetailsResponse;
    let salt: MasterPasswordSalt;
    let kdfConfig: KdfConfig;
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;
    let userKey: UserKey;

    beforeEach(() => {
      // Mock feature flag value
      configService.getFeatureFlag.mockResolvedValue(
        PM27086_UpdateAuthenticationApisForInputPasswordFlagEnabled,
      );

      // Mock method data
      kdfConfig = DEFAULT_KDF_CONFIG;

      organizationUserResetPasswordDetailsResponse =
        new OrganizationUserResetPasswordDetailsResponse({
          organizationUserId: orgUserId,
          kdf: kdfConfig.kdfType,
          kdfIterations: kdfConfig.iterations,
          resetPasswordKey: "test-reset-password-key",
          encryptedPrivateKey: "test-encrypted-private-key",
        });

      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
        organizationUserResetPasswordDetailsResponse,
      );

      const mockDecryptedOrgKeyBytes = new Uint8Array(64).fill(1);
      const mockDecryptedOrgKey = new SymmetricCryptoKey(mockDecryptedOrgKeyBytes) as OrgKey;

      keyService.orgKeys$.mockReturnValue(
        of({ [orgId]: mockDecryptedOrgKey } as Record<OrganizationId, OrgKey>),
      );

      const mockDecryptedPrivateKeyBytes = new Uint8Array(64).fill(2);
      encryptService.unwrapDecapsulationKey.mockResolvedValue(mockDecryptedPrivateKeyBytes);

      const mockDecryptedUserKeyBytes = new Uint8Array(64).fill(3);
      const mockUserKey = new SymmetricCryptoKey(mockDecryptedUserKeyBytes);
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(mockUserKey); // returns `SymmetricCryptoKey`
      userKey = mockUserKey as UserKey; // type cast to `UserKey` (see code implementation). Points to same object as mockUserKey.

      salt = email as MasterPasswordSalt;
      masterPasswordService.mock.emailToSalt.mockReturnValue(salt);

      authenticationData = {
        salt,
        kdf: kdfConfig,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      unlockData = {
        salt,
        kdf: kdfConfig,
        masterKeyWrappedUserKey: "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      } as MasterPasswordUnlockData;

      masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue(
        authenticationData,
      );
      masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(unlockData);
    });

    it("should throw an error if the organizationUserResetPasswordDetailsResponse is nullish", async () => {
      // Arrange
      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(null);

      // Act
      const promise = sut.resetMasterPassword(newMasterPassword, email, orgUserId, orgId);

      // Assert
      await expect(promise).rejects.toThrow();
    });

    it("should throw an error if the org key cannot be found", async () => {
      // Arrange
      keyService.orgKeys$.mockReturnValue(of({} as Record<OrganizationId, OrgKey>));

      // Act
      const promise = sut.resetMasterPassword(newMasterPassword, email, orgUserId, orgId);

      // Assert
      await expect(promise).rejects.toThrow("No org key found");
    });

    it("should throw an error if orgKeys$ returns null", async () => {
      // Arrange
      keyService.orgKeys$.mockReturnValue(of(null));

      // Act
      const promise = sut.resetMasterPassword(newMasterPassword, email, orgUserId, orgId);

      // Assert
      await expect(promise).rejects.toThrow();
    });

    it("should call makeMasterPasswordAuthenticationData and makeMasterPasswordUnlockData with the correct parameters", async () => {
      // Act
      await sut.resetMasterPassword(newMasterPassword, email, orgUserId, orgId);

      // Assert
      const request = OrganizationUserResetPasswordRequest.newConstructor(
        authenticationData,
        unlockData,
      );

      expect(masterPasswordService.mock.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        newMasterPassword,
        kdfConfig,
        salt,
      );

      expect(masterPasswordService.mock.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
        newMasterPassword,
        kdfConfig,
        salt,
        userKey,
      );

      expect(organizationUserApiService.putOrganizationUserResetPassword).toHaveBeenCalledWith(
        orgId,
        orgUserId,
        request,
      );
    });

    it("should call the API method to reset the user's master password", async () => {
      // Act
      await sut.resetMasterPassword(newMasterPassword, email, orgUserId, orgId);

      // Assert
      const request = OrganizationUserResetPasswordRequest.newConstructor(
        authenticationData,
        unlockData,
      );
      expect(organizationUserApiService.putOrganizationUserResetPassword).toHaveBeenCalledTimes(1);
      expect(organizationUserApiService.putOrganizationUserResetPassword).toHaveBeenCalledWith(
        orgId,
        orgUserId,
        request,
      );
    });
  });

  describe("getPublicKeys", () => {
    it("should return public keys for organizations that have reset password enrolled", async () => {
      const result = await sut.getPublicKeys("userId" as UserId);
      expect(result).toHaveLength(1);
    });

    it("should result should contain the correct data for the org", async () => {
      const result = await sut.getPublicKeys("userId" as UserId);
      expect(result[0].orgId).toBe("1");
      expect(result[0].orgName).toBe("org1");
      expect(result[0].publicKey).toEqual(Utils.fromB64ToArray("publicKey"));
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
          publicKey: Utils.fromUtf8ToArray("test-public-key"),
        }),
      );
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(
        new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "mockEncryptedUserKey"),
      );
    });

    it("should return all re-encrypted account recovery keys", async () => {
      const result = await sut.getRotatedData(
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        mockPublicKeys,
        "mockUserId" as UserId,
      );

      expect(result).toHaveLength(2);
    });

    it("throws if the new user key is null", async () => {
      await expect(
        sut.getRotatedData(null, mockPublicKeys, "mockUserId" as UserId),
      ).rejects.toThrow("New user key is required for rotation.");
    });
  });
});

function createOrganization(id: string, name: string, resetPasswordEnrolled = true): Organization {
  const org = new Organization();
  org.id = id;
  org.name = name;
  org.identifier = name;
  org.isMember = true;
  org.resetPasswordEnrolled = resetPasswordEnrolled;
  return org;
}
