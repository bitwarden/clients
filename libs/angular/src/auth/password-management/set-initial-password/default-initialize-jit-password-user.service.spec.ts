// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeEncString, makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { fromSdkKdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";
import {
  AuthClient,
  BitwardenClient,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import { DefaultInitializeJitPasswordUserService } from "./default-initialize-jit-password-user.service";
import {
  InitializeJitPasswordCredentials,
  InitializeJitPasswordUserService,
} from "./initialize-jit-password-user.service.abstraction";

describe("DefaultInitializeJitPasswordUserService", () => {
  let sut: InitializeJitPasswordUserService;

  // Mocked dependencies
  const kdfConfigService = mock<KdfConfigService>();
  const keyService = mock<KeyService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const registerSdkService = mock<RegisterSdkService>();

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
    master_key: makeSymmetricCryptoKey(32).keyB64,
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

    keyService.hashMasterKey.mockResolvedValue("local-hash");

    sut = new DefaultInitializeJitPasswordUserService(
      kdfConfigService,
      keyService,
      masterPasswordService,
      organizationApiService,
      userDecryptionOptionsService,
      accountCryptographicStateService,
      registerSdkService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("initializeUser()", () => {
    it("should successfully initialize JIT password user with all valid credentials and verify all state operations", async () => {
      await sut.initializeUser(credentials, userId);

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

      expect(keyService.setUserKey).toHaveBeenCalledWith(
        SymmetricCryptoKey.fromString(sdkRegistrationResult.user_key) as UserKey,
        userId,
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

      const expectedMasterKey = SymmetricCryptoKey.fromString(
        sdkRegistrationResult.master_key,
      ) as MasterKey;
      expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(expectedMasterKey, userId);

      expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString(sdkRegistrationResult.master_password_unlock.masterKeyWrappedUserKey),
        userId,
      );

      expect(keyService.hashMasterKey).toHaveBeenCalledWith(
        credentials.newPassword,
        expectedMasterKey,
        HashPurpose.LocalAuthorization,
      );
      expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith("local-hash", userId);
    });

    describe("input validation", () => {
      it("should throw error when orgSsoIdentifier is null", async () => {
        const invalidCredentials = {
          ...credentials,
          orgSsoIdentifier: null,
        } as unknown as InitializeJitPasswordCredentials;

        const promise = sut.initializeUser(invalidCredentials, userId);

        await expect(promise).rejects.toThrow("Organization SSO identifier is required.");

        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw error when orgId is null", async () => {
        const invalidCredentials = {
          ...credentials,
          orgId: null,
        } as unknown as InitializeJitPasswordCredentials;

        const promise = sut.initializeUser(invalidCredentials, userId);

        await expect(promise).rejects.toThrow("Organization id is required.");

        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw error when newPassword is null", async () => {
        const invalidCredentials = {
          ...credentials,
          newPassword: null,
        } as unknown as InitializeJitPasswordCredentials;

        const promise = sut.initializeUser(invalidCredentials, userId);

        await expect(promise).rejects.toThrow("New password is required.");

        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw error when salt is null", async () => {
        const invalidCredentials = {
          ...credentials,
          salt: null,
        } as unknown as InitializeJitPasswordCredentials;

        const promise = sut.initializeUser(invalidCredentials, userId);

        await expect(promise).rejects.toThrow("Salt is required.");

        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw error when userId is null", async () => {
        const nullUserId = null as unknown as UserId;

        const promise = sut.initializeUser(credentials, nullUserId);

        await expect(promise).rejects.toThrow("User ID is required.");
        expect(organizationApiService.getKeys).not.toHaveBeenCalled();
      });
    });

    describe("organization API error handling", () => {
      it("should throw when organizationApiService.getKeys returns null", async () => {
        organizationApiService.getKeys.mockResolvedValue(
          null as unknown as OrganizationKeysResponse,
        );

        const promise = sut.initializeUser(credentials, userId);

        await expect(promise).rejects.toThrow("Organization keys response is null.");
        expect(organizationApiService.getKeys).toHaveBeenCalledWith(credentials.orgId);
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw when organizationApiService.getKeys rejects", async () => {
        const apiError = new Error("API network error");
        organizationApiService.getKeys.mockRejectedValue(apiError);

        const promise = sut.initializeUser(credentials, userId);

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

        const promise = sut.initializeUser(credentials, userId);

        await expect(promise).rejects.toThrow("SDK not available");
      });

      it("should throw when SDK registration fails", async () => {
        const sdkError = new Error("SDK crypto operation failed");

        organizationApiService.getKeys.mockResolvedValue(orgKeys);
        mockRegistration.mockRejectedValue(sdkError);

        const promise = sut.initializeUser(credentials, userId);

        await expect(promise).rejects.toThrow("SDK crypto operation failed");
      });
    });

    it("should throw when account_cryptographic_state is not V2", async () => {
      const invalidResult = {
        ...sdkRegistrationResult,
        account_cryptographic_state: { V1: {} } as unknown as WrappedAccountCryptographicState,
      };

      mockRegistration.mockResolvedValue(invalidResult);

      const promise = sut.initializeUser(credentials, userId);

      await expect(promise).rejects.toThrow("Unexpected V2 account cryptographic state");
    });
  });
});
