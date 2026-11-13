// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "@bitwarden/common/auth/models/request/update-tde-offboarding-password.request";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { makeEncString, makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  EncryptService,
  EncString,
  fromSdkKdfConfig,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import {
  AuthClient,
  BitwardenClient,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { DefaultSetInitialPasswordService } from "./default-set-initial-password.service.implementation";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordTdeUserWithPermissionCredentials,
} from "./set-initial-password.service.abstraction";

describe("DefaultSetInitialPasswordService", () => {
  let sut: SetInitialPasswordService;

  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let keyService: MockProxy<KeyService>;
  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;
  let unlockService: MockProxy<UnlockService>;
  const registerSdkService = mock<RegisterSdkService>();

  let userId: UserId;
  let userKey: UserKey;

  beforeEach(() => {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    keyService = mock<KeyService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    unlockService = mock<UnlockService>();

    userId = "userId" as UserId;
    userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

    sut = new DefaultSetInitialPasswordService(
      apiService,
      encryptService,
      i18nService,
      kdfConfigService,
      keyService,
      legacyCompatKeyService,
      masterPasswordApiService,
      masterPasswordService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
      accountCryptographicStateService,
      registerSdkService,
      unlockService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("setInitialPasswordTdeOffboarding()", () => {
    // Mock method parameters
    let credentials: SetInitialPasswordTdeOffboardingCredentials;

    // Mock method data
    let userKey: UserKey;
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;
    let request: UpdateTdeOffboardingPasswordRequest;

    beforeEach(() => {
      credentials = {
        newPassword: "new-Password",
        salt: "salt" as MasterPasswordSalt,
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
      };

      userKey = makeSymmetricCryptoKey(64) as UserKey;

      authenticationData = {
        salt: credentials.salt,
        kdf: credentials.kdfConfig,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      unlockData = {
        salt: credentials.salt,
        kdf: credentials.kdfConfig,
        masterKeyWrappedUserKey: "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      } as MasterPasswordUnlockData;

      request = new UpdateTdeOffboardingPasswordRequest(
        authenticationData,
        unlockData,
        credentials.newPasswordHint,
      );

      keyService.userKey$.mockReturnValue(of(userKey));
      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        authenticationData,
      );
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(unlockData);
    });

    describe("general error handling", () => {
      ["newPassword", "salt"].forEach((key) => {
        it(`should throw if ${key} is an empty string (falsy) on the SetInitialPasswordTdeOffboardingCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordTdeOffboardingCredentials = {
            ...credentials,
            [key]: "",
          };

          // Act
          const promise = sut.setInitialPasswordTdeOffboarding(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(`${key} is falsy. Could not set initial password.`);
        });
      });

      ["kdfConfig", "newPasswordHint"].forEach((key) => {
        it(`should throw if ${key} is null/undefined on the SetInitialPasswordTdeOffboardingCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordTdeOffboardingCredentials = {
            ...credentials,
            [key]: null,
          };

          // Act
          const promise = sut.setInitialPasswordTdeOffboarding(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            `${key} is null or undefined. Could not set initial password.`,
          );
        });
      });

      it(`should throw if the userId was not passed in`, async () => {
        // Arrange
        userId = null as unknown as UserId;

        // Act
        const promise = sut.setInitialPasswordTdeOffboarding(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow("userId not found. Could not set password.");
      });

      it(`should throw if the userKey was not found`, async () => {
        // Arrange
        keyService.userKey$.mockReturnValue(of(null));

        // Act
        const promise = sut.setInitialPasswordTdeOffboarding(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow("userKey not found. Could not set password.");
      });
    });

    it("should call makeMasterPasswordAuthenticationData and makeMasterPasswordUnlockData with the correct parameters", async () => {
      // Act
      await sut.setInitialPasswordTdeOffboarding(credentials, userId);

      // Assert
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        credentials.newPassword,
        credentials.kdfConfig,
        credentials.salt,
      );

      expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
        credentials.newPassword,
        credentials.kdfConfig,
        credentials.salt,
        userKey,
      );
    });

    it("should call the API method to set a master password", async () => {
      // Act
      await sut.setInitialPasswordTdeOffboarding(credentials, userId);

      // Assert
      expect(masterPasswordApiService.putUpdateTdeOffboardingPassword).toHaveBeenCalledTimes(1);
      expect(masterPasswordApiService.putUpdateTdeOffboardingPassword).toHaveBeenCalledWith(
        request,
      );
    });

    it("should set the ForceSetPasswordReason to None", async () => {
      // Act
      await sut.setInitialPasswordTdeOffboarding(credentials, userId);

      // Assert
      expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
        ForceSetPasswordReason.None,
        userId,
      );
    });
  });

  describe("initializePasswordJitPasswordUserV2Encryption()", () => {
    let mockSdkRef: {
      value: MockProxy<BitwardenClient>;
      [Symbol.dispose]: jest.Mock;
    };
    let mockSdk: {
      take: jest.Mock;
    };
    let mockRegistration: jest.Mock;

    const userId = "d4e2e3a1-1b5e-4c3b-8d7a-9f8e7d6c5b4a" as UserId;
    const orgId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d" as OrganizationId;

    const credentials: InitializeJitPasswordCredentials = {
      newPasswordHint: "test-hint",
      orgSsoIdentifier: "org-sso-id",
      orgId: orgId,
      resetPasswordAutoEnroll: false,
      newPassword: "Test@Password123!",
      salt: "user@example.com" as unknown as MasterPasswordSalt,
    };

    const orgKeys: OrganizationKeysResponse = {
      publicKey: "org-public-key-base64",
      privateKey: "org-private-key-encrypted",
    } as OrganizationKeysResponse;

    const sdkRegistrationResult = {
      account_cryptographic_state: {
        V2: {
          private_key: makeEncString().encryptedString!,
          signed_public_key: "test-signed-public-key",
          signing_key: makeEncString().encryptedString!,
          security_state: "test-security-state",
        },
      },
      master_password_unlock: {
        kdf: {
          pBKDF2: {
            iterations: 600000,
          },
        },
        masterKeyWrappedUserKey: makeEncString().encryptedString!,
        salt: "user@example.com" as unknown as MasterPasswordSalt,
      },
      user_key: makeSymmetricCryptoKey(64).keyB64,
    };

    beforeEach(() => {
      jest.clearAllMocks();

      mockSdkRef = {
        value: mock<BitwardenClient>(),
        [Symbol.dispose]: jest.fn(),
      };

      mockSdkRef.value.auth.mockReturnValue({
        registration: jest.fn().mockReturnValue({
          post_keys_for_jit_password_registration: jest.fn(),
        }),
      } as unknown as AuthClient);

      mockSdk = {
        take: jest.fn().mockReturnValue(mockSdkRef),
      };

      registerSdkService.registerClient$.mockReturnValue(
        of(mockSdk) as unknown as Observable<Rc<BitwardenClient>>,
      );

      organizationApiService.getKeys.mockResolvedValue(orgKeys);

      mockRegistration = mockSdkRef.value.auth().registration()
        .post_keys_for_jit_password_registration as unknown as jest.Mock;
      mockRegistration.mockResolvedValue(sdkRegistrationResult);

      const mockUserDecryptionOpts = new UserDecryptionOptions({ hasMasterPassword: false });
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of(mockUserDecryptionOpts),
      );
    });

    it("should successfully initialize JIT password user", async () => {
      await sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      expect(organizationApiService.getKeys).toHaveBeenCalledWith(credentials.orgId);

      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(mockRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: credentials.orgId,
          org_public_key: orgKeys.publicKey,
          master_password: credentials.newPassword,
          master_password_hint: credentials.newPasswordHint,
          salt: credentials.salt,
          organization_sso_identifier: credentials.orgSsoIdentifier,
          user_id: userId,
          reset_password_enroll: credentials.resetPasswordAutoEnroll,
        }),
      );

      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
        sdkRegistrationResult.account_cryptographic_state,
        userId,
      );

      expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
        ForceSetPasswordReason.None,
        userId,
      );

      expect(masterPasswordService.setMasterPasswordUnlockData).toHaveBeenCalledWith(
        MasterPasswordUnlockData.fromSdk(sdkRegistrationResult.master_password_unlock),
        userId,
      );

      expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        userId,
        SymmetricCryptoKey.fromString(sdkRegistrationResult.user_key) as UserKey,
      );

      // Verify legacy state updates below
      expect(userDecryptionOptionsService.userDecryptionOptionsById$).toHaveBeenCalledWith(userId);
      expect(userDecryptionOptionsService.setUserDecryptionOptionsById).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ hasMasterPassword: true }),
      );

      expect(kdfConfigService.setKdfConfig).toHaveBeenCalledWith(
        userId,
        fromSdkKdfConfig(sdkRegistrationResult.master_password_unlock.kdf),
      );
    });

    describe("input validation", () => {
      it.each([
        "newPasswordHint",
        "orgSsoIdentifier",
        "orgId",
        "resetPasswordAutoEnroll",
        "newPassword",
        "salt",
      ])("should throw error when %s is null", async (field) => {
        const invalidCredentials = {
          ...credentials,
          [field]: null,
        } as unknown as InitializeJitPasswordCredentials;

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(
          invalidCredentials,
          userId,
        );

        await expect(promise).rejects.toThrow(`${field} is required.`);

        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw error when userId is null", async () => {
        const nullUserId = null as unknown as UserId;

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, nullUserId);

        await expect(promise).rejects.toThrow("User ID is required.");
        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
      });
    });

    describe("organization API error handling", () => {
      it("should throw when organizationApiService.getKeys returns null", async () => {
        organizationApiService.getKeys.mockResolvedValue(
          null as unknown as OrganizationKeysResponse,
        );

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

        await expect(promise).rejects.toThrow("Organization keys response is null.");
        expect(organizationApiService.getKeys).toHaveBeenCalledWith(credentials.orgId);
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw when organizationApiService.getKeys rejects", async () => {
        const apiError = new Error("API network error");
        organizationApiService.getKeys.mockRejectedValue(apiError);

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

        await expect(promise).rejects.toThrow("API network error");
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });
    });

    describe("SDK error handling", () => {
      it("should throw when SDK is not available", async () => {
        organizationApiService.getKeys.mockResolvedValue(orgKeys);
        registerSdkService.registerClient$.mockReturnValue(
          of(null) as unknown as Observable<Rc<BitwardenClient>>,
        );

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

        await expect(promise).rejects.toThrow("SDK not available");
      });

      it("should throw when SDK registration fails", async () => {
        const sdkError = new Error("SDK crypto operation failed");

        organizationApiService.getKeys.mockResolvedValue(orgKeys);
        mockRegistration.mockRejectedValue(sdkError);

        const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

        await expect(promise).rejects.toThrow("SDK crypto operation failed");
      });
    });

    it("should throw when account_cryptographic_state is not V2", async () => {
      const invalidResult = {
        ...sdkRegistrationResult,
        account_cryptographic_state: { V1: {} } as unknown as WrappedAccountCryptographicState,
      };

      mockRegistration.mockResolvedValue(invalidResult);

      const promise = sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      await expect(promise).rejects.toThrow("Unexpected V2 account cryptographic state");
    });
  });

  describe("setInitialPasswordTdeUserWithPermission()", () => {
    // Mock method parameters
    let credentials: SetInitialPasswordTdeUserWithPermissionCredentials;

    // Mock method data
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;
    let setPasswordRequest: SetPasswordRequest;
    let userDecryptionOptions: UserDecryptionOptions;

    beforeEach(() => {
      // Mock method parameters
      credentials = {
        newPassword: "newPassword123!",
        salt: "user@example.com" as MasterPasswordSalt,
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId" as OrganizationId,
        resetPasswordAutoEnroll: false,
      };

      // Mock method data
      userKey = makeSymmetricCryptoKey(64) as UserKey;
      keyService.userKey$.mockReturnValue(of(userKey));

      authenticationData = {
        salt: credentials.salt,
        kdf: credentials.kdfConfig,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };
      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        authenticationData,
      );

      unlockData = {
        salt: credentials.salt,
        kdf: credentials.kdfConfig,
        masterKeyWrappedUserKey: "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      } as MasterPasswordUnlockData;
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(unlockData);

      setPasswordRequest = SetPasswordRequest.newConstructor(
        authenticationData,
        unlockData,
        credentials.newPasswordHint,
        credentials.orgSsoIdentifier,
        null, // no KeysRequest for TDE user because they already have a key pair
      );

      userDecryptionOptions = new UserDecryptionOptions({ hasMasterPassword: false });
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of(userDecryptionOptions),
      );
    });

    describe("general error handling", () => {
      ["newPassword", "salt", "orgSsoIdentifier", "orgId"].forEach((key) => {
        it(`should throw if ${key} is an empty string (falsy) on the SetInitialPasswordTdeUserWithPermissionCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordTdeUserWithPermissionCredentials = {
            ...credentials,
            [key]: "",
          };

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            `${key} is falsy. Could not set initial password for TDE user with Manage Account Recovery permission.`,
          );
        });
      });

      ["kdfConfig", "newPasswordHint", "resetPasswordAutoEnroll"].forEach((key) => {
        it(`should throw if ${key} is null on the SetInitialPasswordTdeUserWithPermissionCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordTdeUserWithPermissionCredentials = {
            ...credentials,
            [key]: null,
          };

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            `${key} is null or undefined. Could not set initial password for TDE user with Manage Account Recovery permission.`,
          );
        });
      });

      it("should throw if userId is not given", async () => {
        // Arrange
        userId = null as unknown as UserId;

        // Act
        const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow(
          "userId is falsy. Could not set initial password for TDE user with Manage Account Recovery permission.",
        );
      });
    });

    it("should throw if the userKey is not found", async () => {
      // Arrange
      keyService.userKey$.mockReturnValue(of(null));

      // Act
      const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

      // Assert
      await expect(promise).rejects.toThrow("userKey not found.");
    });

    it("should call makeMasterPasswordAuthenticationData and makeMasterPasswordUnlockData with the correct parameters", async () => {
      // Act
      await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

      // Assert
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        credentials.newPassword,
        credentials.kdfConfig,
        credentials.salt,
      );

      expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
        credentials.newPassword,
        credentials.kdfConfig,
        credentials.salt,
        userKey,
      );
    });

    it("should call the API method to set a master password", async () => {
      // Act
      await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

      // Assert
      expect(masterPasswordApiService.setPassword).toHaveBeenCalledTimes(1);
      expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
    });

    describe("given the initial password has been successfully set", () => {
      it("should clear the ForceSetPasswordReason by setting it to None", async () => {
        // Act
        await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
          ForceSetPasswordReason.None,
          userId,
        );
      });

      it("should set MasterPasswordUnlockData to state", async () => {
        // Act
        await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        expect(masterPasswordService.setMasterPasswordUnlockData).toHaveBeenCalledWith(
          unlockData,
          userId,
        );
      });

      it("should update legacy state", async () => {
        // Act
        await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        expect(userDecryptionOptionsService.setUserDecryptionOptionsById).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ hasMasterPassword: true }),
        );
        expect(kdfConfigService.setKdfConfig).toHaveBeenCalledWith(userId, credentials.kdfConfig);
      });

      describe("given resetPasswordAutoEnroll is false", () => {
        it("should NOT handle reset password (account recovery) auto enroll", async () => {
          // Act
          await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          expect(
            organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
          ).not.toHaveBeenCalled();
        });
      });

      describe("given resetPasswordAutoEnroll is true", () => {
        let organizationKeys: OrganizationKeysResponse;
        let orgPublicKeyEncryptedUserKey: EncString;
        let enrollmentRequest: OrganizationUserResetPasswordEnrollmentRequest;

        beforeEach(() => {
          credentials.resetPasswordAutoEnroll = true;

          organizationKeys = {
            privateKey: "orgPrivateKey",
            publicKey: "orgPublicKey",
          } as OrganizationKeysResponse;
          organizationApiService.getKeys.mockResolvedValue(organizationKeys);

          orgPublicKeyEncryptedUserKey = new EncString("orgPublicKeyEncryptedUserKey");
          encryptService.encapsulateKeyUnsigned.mockResolvedValue(orgPublicKeyEncryptedUserKey);

          enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest();
          enrollmentRequest.masterPasswordHash =
            authenticationData.masterPasswordAuthenticationHash;
          enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString!;
        });

        it("should throw if organization keys are not found", async () => {
          // Arrange
          organizationApiService.getKeys.mockResolvedValue(
            null as unknown as OrganizationKeysResponse,
          );

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            "Organization keys response is null. Could not handle reset password auto enroll.",
          );
        });

        it("should throw if orgPublicKeyEncryptedUserKey is not found", async () => {
          // Arrange
          encryptService.encapsulateKeyUnsigned.mockResolvedValue(null as unknown as EncString);

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
          );
        });

        it("should throw if orgPublicKeyEncryptedUserKey.encryptedString is not found", async () => {
          // Arrange
          orgPublicKeyEncryptedUserKey.encryptedString = null as unknown as any;

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
          );
        });

        it("should call the API method to handle reset password (account recovery) auto enroll", async () => {
          // Act
          await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          expect(
            organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
          ).toHaveBeenCalledTimes(1);
          expect(
            organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
          ).toHaveBeenCalledWith(credentials.orgId, userId, enrollmentRequest);
        });
      });
    });
  });
});
