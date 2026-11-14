import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordDetailsResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey, OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  CsprngArray,
  DEFAULT_KDF_CONFIG,
  EncryptionType,
  EncryptService,
  EncString,
  KdfConfig,
  KdfType,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { OrganizationUserResetPasswordService } from "./organization-user-reset-password.service";

const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
const mockPublicKeys = [Utils.fromUtf8ToArray("test-public-key")];

describe("OrganizationUserResetPasswordService", () => {
  let sut: OrganizationUserResetPasswordService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationApiService: MockProxy<OrganizationApiService>;
  let i18nService: MockProxy<I18nService>;
  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeAll(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationApiService = mock<OrganizationApiService>();
    i18nService = mock<I18nService>();
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();

    sut = new OrganizationUserResetPasswordService(
      keyService,
      encryptService,
      organizationUserApiService,
      organizationApiService,
      i18nService,
      accountService,
      masterPasswordService,
    );
  });

  beforeEach(() => {
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

  describe("recoverAccount", () => {
    const newMasterPassword = "new-master-password";
    const email = "user@example.com";
    const orgUserId = "org-user-id";
    const orgId = "org-id" as OrganizationId;
    const SERVER_SIDE_SALT = "server-side-salt" as MasterPasswordSalt;

    let kdfConfig: KdfConfig;
    let salt: MasterPasswordSalt;
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;

    /**
     * Sets up mocks needed when resetMasterPassword is true.
     *
     * @param useServerSalt when true (default), the response includes a server-provided
     *   `masterPasswordSalt`; when false, the response omits it so the email-fallback
     *   path is exercised
     */
    function setupPasswordResetMocks(useServerSalt: boolean = true) {
      kdfConfig = DEFAULT_KDF_CONFIG;

      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
        new OrganizationUserResetPasswordDetailsResponse({
          organizationUserId: orgUserId,
          kdf: kdfConfig.kdfType,
          kdfIterations: kdfConfig.iterations,
          resetPasswordKey: "test-reset-password-key",
          encryptedPrivateKey: "test-encrypted-private-key",
          ...(useServerSalt ? { masterPasswordSalt: SERVER_SIDE_SALT } : {}),
        }),
      );

      const mockDecryptedOrgKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as OrgKey;
      keyService.orgKeys$.mockReturnValue(
        of({ [orgId]: mockDecryptedOrgKey } as Record<OrganizationId, OrgKey>),
      );

      encryptService.unwrapDecapsulationKey.mockResolvedValue(new Uint8Array(64).fill(2));

      const mockDecryptedUserKey = new SymmetricCryptoKey(new Uint8Array(64).fill(3));
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(mockDecryptedUserKey);

      if (useServerSalt) {
        salt = SERVER_SIDE_SALT;
      } else {
        salt = email as MasterPasswordSalt;
        masterPasswordService.mock.emailToSalt.mockReturnValue(salt);
      }

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
    }

    describe("reset 2FA only", () => {
      it("should call putOrganizationUserRecoverAccount with resetTwoFactor: true and resetMasterPassword: false", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: false,
          resetTwoFactor: true,
        });

        expect(organizationUserApiService.putOrganizationUserRecoverAccount).toHaveBeenCalledWith(
          orgId,
          orgUserId,
          expect.objectContaining({
            resetMasterPassword: false,
            resetTwoFactor: true,
            authenticationData: undefined,
            unlockData: undefined,
          }),
        );
      });

      it("should not fetch reset password details when only resetting 2FA", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: false,
          resetTwoFactor: true,
        });

        expect(
          organizationUserApiService.getOrganizationUserResetPasswordDetails,
        ).not.toHaveBeenCalled();
      });

      it("should not perform any crypto operations when only resetting 2FA", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: false,
          resetTwoFactor: true,
        });

        expect(encryptService.unwrapDecapsulationKey).not.toHaveBeenCalled();
        expect(encryptService.decapsulateKeyUnsigned).not.toHaveBeenCalled();
      });
    });

    describe("reset master password only — server omits salt → email fallback", () => {
      beforeEach(() => {
        setupPasswordResetMocks(/* useServerSalt */ false);
      });

      it("should call putOrganizationUserRecoverAccount with resetMasterPassword: true and resetTwoFactor: false", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(organizationUserApiService.putOrganizationUserRecoverAccount).toHaveBeenCalledWith(
          orgId,
          orgUserId,
          expect.objectContaining({ resetMasterPassword: true, resetTwoFactor: false }),
        );
      });

      it("should derive the salt from the email and pass it to the master password helpers", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(masterPasswordService.mock.emailToSalt).toHaveBeenCalledWith(email);
        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenCalledWith(newMasterPassword, kdfConfig, salt);
        expect(masterPasswordService.mock.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
          newMasterPassword,
          kdfConfig,
          salt,
          expect.anything(),
        );
      });

      it("should still complete the recover-account API call with the fallback-derived data", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(organizationUserApiService.putOrganizationUserRecoverAccount).toHaveBeenCalledWith(
          orgId,
          orgUserId,
          expect.objectContaining({
            resetMasterPassword: true,
            resetTwoFactor: false,
            authenticationData,
            unlockData,
          }),
        );
      });

      it("should throw if reset password details are null", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(null);

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow();
      });

      it("should throw if org key is null", async () => {
        keyService.orgKeys$.mockReturnValue(of(null));

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow();
      });
    });

    describe("reset master password only — server provides salt", () => {
      beforeEach(() => {
        setupPasswordResetMocks(true);
      });

      it("should call putOrganizationUserRecoverAccount with password data and resetTwoFactor: false", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(organizationUserApiService.putOrganizationUserRecoverAccount).toHaveBeenCalledWith(
          orgId,
          orgUserId,
          expect.objectContaining({
            resetMasterPassword: true,
            resetTwoFactor: false,
            authenticationData,
            unlockData,
          }),
        );
      });

      it("should pass the server-provided salt (not the email) to the master password helpers", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenCalledWith(newMasterPassword, kdfConfig, SERVER_SIDE_SALT);
        expect(masterPasswordService.mock.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
          newMasterPassword,
          kdfConfig,
          SERVER_SIDE_SALT,
          expect.anything(),
        );
        expect(masterPasswordService.mock.emailToSalt).not.toHaveBeenCalled();
      });

      it("should throw if reset password details are null", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(null);

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow();
      });

      it("should throw if org key cannot be found", async () => {
        keyService.orgKeys$.mockReturnValue(of({} as Record<OrganizationId, OrgKey>));

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow("No org key found");
      });
    });

    describe("reset both master password and 2FA", () => {
      beforeEach(() => {
        setupPasswordResetMocks();
      });

      it("should call putOrganizationUserRecoverAccount with both flags true and password data", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: true,
          newMasterPassword,
          email,
        });

        expect(organizationUserApiService.putOrganizationUserRecoverAccount).toHaveBeenCalledWith(
          orgId,
          orgUserId,
          expect.objectContaining({
            resetMasterPassword: true,
            resetTwoFactor: true,
            authenticationData,
            unlockData,
          }),
        );
      });

      it("should fetch reset password details when resetting both", async () => {
        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: true,
          newMasterPassword,
          email,
        });

        expect(
          organizationUserApiService.getOrganizationUserResetPasswordDetails,
        ).toHaveBeenCalledWith(orgId, orgUserId);
      });
    });

    describe("validation when resetMasterPassword is true", () => {
      it("should throw when newMasterPassword is undefined", async () => {
        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            email,
          }),
        ).rejects.toThrow();

        expect(i18nService.t).toHaveBeenCalledWith("resetPasswordNewPasswordRequired");
        expect(
          organizationUserApiService.getOrganizationUserResetPasswordDetails,
        ).not.toHaveBeenCalled();
      });

      it("should throw when newMasterPassword is whitespace", async () => {
        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword: "   ",
            email,
          }),
        ).rejects.toThrow();

        expect(i18nService.t).toHaveBeenCalledWith("resetPasswordNewPasswordRequired");
      });

      it("should throw when email is undefined", async () => {
        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
          }),
        ).rejects.toThrow();

        expect(i18nService.t).toHaveBeenCalledWith("emailRequired");
        expect(
          organizationUserApiService.getOrganizationUserResetPasswordDetails,
        ).not.toHaveBeenCalled();
      });

      it("should throw when email is whitespace", async () => {
        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email: "   ",
          }),
        ).rejects.toThrow();

        expect(i18nService.t).toHaveBeenCalledWith("emailRequired");
      });
    });

    describe("KDF config", () => {
      beforeEach(() => {
        const mockDecryptedOrgKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as OrgKey;
        keyService.orgKeys$.mockReturnValue(
          of({ [orgId]: mockDecryptedOrgKey } as Record<OrganizationId, OrgKey>),
        );
        encryptService.unwrapDecapsulationKey.mockResolvedValue(new Uint8Array(64).fill(2));
        encryptService.decapsulateKeyUnsigned.mockResolvedValue(
          new SymmetricCryptoKey(new Uint8Array(64).fill(3)),
        );

        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue({
          salt: SERVER_SIDE_SALT,
          kdf: DEFAULT_KDF_CONFIG,
          masterPasswordAuthenticationHash:
            "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
        });
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue({
          salt: SERVER_SIDE_SALT,
          kdf: DEFAULT_KDF_CONFIG,
          masterKeyWrappedUserKey: "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData);
      });

      it("should construct an Argon2 KDF config when the response uses Argon2id", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
          new OrganizationUserResetPasswordDetailsResponse({
            organizationUserId: orgUserId,
            kdf: KdfType.Argon2id,
            kdfIterations: 3,
            kdfMemory: 64,
            kdfParallelism: 4,
            masterPasswordSalt: SERVER_SIDE_SALT,
            resetPasswordKey: "test-reset-password-key",
            encryptedPrivateKey: "test-encrypted-private-key",
          }),
        );

        await sut.recoverAccount({
          organizationUserId: orgUserId,
          organizationId: orgId,
          resetMasterPassword: true,
          resetTwoFactor: false,
          newMasterPassword,
          email,
        });

        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenCalledWith(newMasterPassword, expect.any(Argon2KdfConfig), SERVER_SIDE_SALT);
        const passedConfig =
          masterPasswordService.mock.makeMasterPasswordAuthenticationData.mock.calls[0][1];
        expect(passedConfig).toEqual(
          expect.objectContaining({ iterations: 3, memory: 64, parallelism: 4 }),
        );
      });

      it("should throw when Argon2id config is missing kdfMemory", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
          new OrganizationUserResetPasswordDetailsResponse({
            organizationUserId: orgUserId,
            kdf: KdfType.Argon2id,
            kdfIterations: 3,
            kdfParallelism: 4,
            masterPasswordSalt: SERVER_SIDE_SALT,
            resetPasswordKey: "test-reset-password-key",
            encryptedPrivateKey: "test-encrypted-private-key",
          }),
        );

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow("Invalid KDF configuration");
      });

      it("should throw when Argon2id config is missing kdfParallelism", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
          new OrganizationUserResetPasswordDetailsResponse({
            organizationUserId: orgUserId,
            kdf: KdfType.Argon2id,
            kdfIterations: 3,
            kdfMemory: 64,
            masterPasswordSalt: SERVER_SIDE_SALT,
            resetPasswordKey: "test-reset-password-key",
            encryptedPrivateKey: "test-encrypted-private-key",
          }),
        );

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow("Invalid KDF configuration");
      });

      it("should throw when KDF type is unsupported", async () => {
        organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
          new OrganizationUserResetPasswordDetailsResponse({
            organizationUserId: orgUserId,
            kdf: 99 as unknown as KdfType,
            kdfIterations: 100000,
            masterPasswordSalt: SERVER_SIDE_SALT,
            resetPasswordKey: "test-reset-password-key",
            encryptedPrivateKey: "test-encrypted-private-key",
          }),
        );

        await expect(
          sut.recoverAccount({
            organizationUserId: orgUserId,
            organizationId: orgId,
            resetMasterPassword: true,
            resetTwoFactor: false,
            newMasterPassword,
            email,
          }),
        ).rejects.toThrow("Unsupported KDF type");
      });
    });
  });
});
