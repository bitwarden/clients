// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

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
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeEncString, makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey, UserPrivateKey, UserPublicKey } from "@bitwarden/common/types/key";
import {
  DEFAULT_KDF_CONFIG,
  fromSdkKdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import {
  AuthClient,
  BitwardenClient,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import { DefaultSetInitialPasswordService } from "./default-set-initial-password.service.implementation";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordTdeOffboardingCredentialsOld,
  SetInitialPasswordTdeUserWithPermissionCredentials,
  SetInitialPasswordUserType,
} from "./set-initial-password.service.abstraction";

describe("DefaultSetInitialPasswordService", () => {
  let sut: SetInitialPasswordService;

  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;
  const registerSdkService = mock<RegisterSdkService>();

  let userId: UserId;
  let userKey: UserKey;
  let userKeyEncString: EncString;
  let masterKeyEncryptedUserKey: [UserKey, EncString];

  beforeEach(() => {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();

    userId = "userId" as UserId;
    userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
    userKeyEncString = new EncString("masterKeyEncryptedUserKey");
    masterKeyEncryptedUserKey = [userKey, userKeyEncString];

    sut = new DefaultSetInitialPasswordService(
      apiService,
      encryptService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
      accountCryptographicStateService,
      registerSdkService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  /**
   * @deprecated To be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("setInitialPassword(...)", () => {
    // Mock function parameters
    let credentials: SetInitialPasswordCredentials;
    let userType: SetInitialPasswordUserType;

    // Mock other function data
    let existingUserPublicKey: UserPublicKey;
    let existingUserPrivateKey: UserPrivateKey;
    let userKeyEncryptedPrivateKey: EncString;

    let keyPair: [string, EncString];
    let keysRequest: KeysRequest;

    let organizationKeys: OrganizationKeysResponse;
    let orgPublicKeyEncryptedUserKey: EncString;

    let userDecryptionOptions: UserDecryptionOptions;
    let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;
    let setPasswordRequest: SetPasswordRequest;

    let enrollmentRequest: OrganizationUserResetPasswordEnrollmentRequest;

    beforeEach(() => {
      // Mock function parameters
      credentials = {
        newMasterKey: new SymmetricCryptoKey(new Uint8Array(32).buffer as CsprngArray) as MasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        newPasswordHint: "newPasswordHint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId",
        resetPasswordAutoEnroll: false,
        newPassword: "Test@Password123!",
        salt: "user@example.com" as any,
      };
      userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;

      // Mock other function data
      existingUserPublicKey = Utils.fromB64ToArray("existingUserPublicKey") as UserPublicKey;
      existingUserPrivateKey = Utils.fromB64ToArray("existingUserPrivateKey") as UserPrivateKey;
      userKeyEncryptedPrivateKey = new EncString("userKeyEncryptedPrivateKey");

      keyPair = ["publicKey", new EncString("privateKey")];
      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);

      organizationKeys = {
        privateKey: "orgPrivateKey",
        publicKey: "orgPublicKey",
      } as OrganizationKeysResponse;
      orgPublicKeyEncryptedUserKey = new EncString("orgPublicKeyEncryptedUserKey");

      userDecryptionOptions = new UserDecryptionOptions({ hasMasterPassword: true });
      userDecryptionOptionsSubject = new BehaviorSubject(userDecryptionOptions);
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        userDecryptionOptionsSubject,
      );

      setPasswordRequest = new SetPasswordRequest(
        credentials.newServerMasterKeyHash,
        masterKeyEncryptedUserKey[1].encryptedString,
        credentials.newPasswordHint,
        credentials.orgSsoIdentifier,
        keysRequest,
        credentials.kdfConfig,
      );

      enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest();
      enrollmentRequest.masterPasswordHash = credentials.newServerMasterKeyHash;
      enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;
    });

    interface MockConfig {
      userType: SetInitialPasswordUserType;
      userHasUserKey: boolean;
      userHasLocalKeyPair: boolean;
      resetPasswordAutoEnroll: boolean;
    }

    const defaultMockConfig: MockConfig = {
      userType: SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER,
      userHasUserKey: true,
      userHasLocalKeyPair: false,
      resetPasswordAutoEnroll: false,
    };

    function setupMocks(config: MockConfig = defaultMockConfig) {
      // Mock makeMasterKeyEncryptedUserKey() values
      if (config.userHasUserKey) {
        keyService.userKey$.mockReturnValue(of(userKey));
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue(masterKeyEncryptedUserKey);
      } else {
        keyService.userKey$.mockReturnValue(of(null));
        keyService.makeUserKey.mockResolvedValue(masterKeyEncryptedUserKey);
      }

      // Mock keyPair values
      if (config.userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
        if (config.userHasLocalKeyPair) {
          keyService.userPrivateKey$.mockReturnValue(of(existingUserPrivateKey));
          keyService.userPublicKey$.mockReturnValue(of(existingUserPublicKey));
          encryptService.wrapDecapsulationKey.mockResolvedValue(userKeyEncryptedPrivateKey);
        } else {
          keyService.userPrivateKey$.mockReturnValue(of(null));
          keyService.userPublicKey$.mockReturnValue(of(null));
          keyService.makeKeyPair.mockResolvedValue(keyPair);
        }
      }

      // Mock handleResetPasswordAutoEnrollOld() values
      if (config.resetPasswordAutoEnroll) {
        organizationApiService.getKeys.mockResolvedValue(organizationKeys);
        encryptService.encapsulateKeyUnsigned.mockResolvedValue(orgPublicKeyEncryptedUserKey);
        keyService.userKey$.mockReturnValue(of(userKey));
      }
    }

    describe("general error handling", () => {
      [
        "newMasterKey",
        "newServerMasterKeyHash",
        "newLocalMasterKeyHash",
        "newPasswordHint",
        "kdfConfig",
        "orgSsoIdentifier",
        "orgId",
        "resetPasswordAutoEnroll",
        "newPassword",
        "salt",
      ].forEach((key) => {
        it(`should throw if ${key} is not provided on the SetInitialPasswordCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordCredentials = {
            ...credentials,
            [key]: null,
          };

          // Act
          const promise = sut.setInitialPassword(invalidCredentials, userType, userId);

          // Assert
          await expect(promise).rejects.toThrow(`${key} not found. Could not set password.`);
        });
      });

      ["userId", "userType"].forEach((param) => {
        it(`should throw if ${param} was not passed in`, async () => {
          // Arrange & Act
          const promise = sut.setInitialPassword(
            credentials,
            param === "userType" ? null : userType,
            param === "userId" ? null : userId,
          );

          // Assert
          await expect(promise).rejects.toThrow(`${param} not found. Could not set password.`);
        });
      });
    });

    describe("given SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER", () => {
      beforeEach(() => {
        userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;
      });

      describe("given the user has an existing local key pair", () => {
        it("should NOT create a brand new key pair for the user", async () => {
          // Arrange
          setPasswordRequest.keys = {
            encryptedPrivateKey: userKeyEncryptedPrivateKey.encryptedString,
            publicKey: Utils.fromBufferToB64(existingUserPublicKey),
          };

          setupMocks({ ...defaultMockConfig, userHasLocalKeyPair: true });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(keyService.userPrivateKey$).toHaveBeenCalledWith(userId);
          expect(keyService.userPublicKey$).toHaveBeenCalledWith(userId);
          expect(encryptService.wrapDecapsulationKey).toHaveBeenCalledWith(
            existingUserPrivateKey,
            masterKeyEncryptedUserKey[0],
          );
          expect(keyService.makeKeyPair).not.toHaveBeenCalled();
        });
      });

      describe("given the user has a userKey", () => {
        it("should successfully set an initial password", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        });
      });

      describe("given the user does NOT have a userKey", () => {
        it("should successfully set an initial password", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userHasUserKey: false });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        });
      });

      it("should throw if a key pair is not found", async () => {
        // Arrange
        keyPair = null;

        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow("keyPair not found. Could not set password.");
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
      });

      it("should throw if an encrypted private key is not found", async () => {
        // Arrange
        keyPair[1].encryptedString = "" as EncryptedString;

        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow(
          "encrypted private key not found. Could not set password.",
        );
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
      });

      describe("given the initial password has been successfully set", () => {
        it("should clear the ForceSetPasswordReason by setting it to None", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.None,
            userId,
          );
          expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
            masterKeyEncryptedUserKey[1],
            userId,
          );
        });

        it("should update account decryption properties", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(userDecryptionOptionsService.setUserDecryptionOptionsById).toHaveBeenCalledWith(
            userId,
            userDecryptionOptions,
          );
          expect(kdfConfigService.setKdfConfig).toHaveBeenCalledWith(userId, credentials.kdfConfig);
          expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(
            credentials.newMasterKey,
            userId,
          );
          expect(keyService.setUserKey).toHaveBeenCalledWith(masterKeyEncryptedUserKey[0], userId);
        });

        it("should set the private key to state", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(
            accountCryptographicStateService.setAccountCryptographicState,
          ).toHaveBeenCalledWith(
            {
              V1: {
                private_key: keyPair[1].encryptedString as EncryptedString,
              },
            },
            userId,
          );
        });

        it("should set the local master key hash to state", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
            credentials.newLocalMasterKeyHash,
            userId,
          );
        });

        it("should create and set master password unlock data to prevent race condition with sync", async () => {
          // Arrange
          setupMocks();

          const mockUnlockData = {
            salt: credentials.salt,
            kdf: credentials.kdfConfig,
            masterKeyWrappedUserKey: "wrapped_key_string",
          };

          masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(
            mockUnlockData as any,
          );

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
            credentials.newPassword,
            credentials.kdfConfig,
            credentials.salt,
            masterKeyEncryptedUserKey[0],
          );
          expect(masterPasswordService.setMasterPasswordUnlockData).toHaveBeenCalledWith(
            mockUnlockData,
            userId,
          );
        });

        describe("given resetPasswordAutoEnroll is true", () => {
          it(`should handle reset password (account recovery) auto enroll`, async () => {
            // Arrange
            credentials.resetPasswordAutoEnroll = true;

            setupMocks({ ...defaultMockConfig, resetPasswordAutoEnroll: true });

            // Act
            await sut.setInitialPassword(credentials, userType, userId);

            // Assert
            expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
            expect(
              organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
            ).toHaveBeenCalledWith(credentials.orgId, userId, enrollmentRequest);
          });

          it("should throw if organization keys are not found", async () => {
            // Arrange
            credentials.resetPasswordAutoEnroll = true;
            organizationKeys = null;

            setupMocks({ ...defaultMockConfig, resetPasswordAutoEnroll: true });

            // Act
            const promise = sut.setInitialPassword(credentials, userType, userId);

            // Assert
            await expect(promise).rejects.toThrow(
              "Organization keys response is null. Could not handle reset password auto enroll.",
            );
            expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
            expect(
              organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
            ).not.toHaveBeenCalled();
          });

          ["orgPublicKeyEncryptedUserKey", "orgPublicKeyEncryptedUserKey.encryptedString"].forEach(
            (property) => {
              it("should throw if orgPublicKeyEncryptedUserKey is not found", async () => {
                // Arrange
                credentials.resetPasswordAutoEnroll = true;

                if (property === "orgPublicKeyEncryptedUserKey") {
                  orgPublicKeyEncryptedUserKey = null;
                } else {
                  orgPublicKeyEncryptedUserKey.encryptedString = "" as EncryptedString;
                }

                setupMocks({ ...defaultMockConfig, resetPasswordAutoEnroll: true });

                // Act
                const promise = sut.setInitialPassword(credentials, userType, userId);

                // Assert
                await expect(promise).rejects.toThrow(
                  "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
                );
                expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(
                  setPasswordRequest,
                );
                expect(
                  organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
                ).not.toHaveBeenCalled();
              });
            },
          );
        });

        describe("given resetPasswordAutoEnroll is false", () => {
          it(`should NOT handle reset password (account recovery) auto enroll`, async () => {
            // Arrange
            credentials.resetPasswordAutoEnroll = false;

            setupMocks();

            // Act
            await sut.setInitialPassword(credentials, userType, userId);

            // Assert
            expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
            expect(
              organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
            ).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe("given SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP", () => {
      beforeEach(() => {
        userType = SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP;
        setPasswordRequest.keys = null;
      });

      it("should NOT generate a keyPair", async () => {
        // Arrange
        setupMocks({ ...defaultMockConfig, userType });

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(keyService.userPrivateKey$).not.toHaveBeenCalled();
        expect(keyService.userPublicKey$).not.toHaveBeenCalled();
        expect(encryptService.wrapDecapsulationKey).not.toHaveBeenCalled();
        expect(keyService.makeKeyPair).not.toHaveBeenCalled();
      });

      describe("given the user has a userKey", () => {
        it("should successfully set an initial password", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        });
      });

      describe("given the user does NOT have a userKey", () => {
        it("should successfully set an initial password", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        });
      });

      describe("given the initial password has been successfully set", () => {
        it("should clear the ForceSetPasswordReason by setting it to None", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.None,
            userId,
          );
        });

        it("should update account decryption properties", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(userDecryptionOptionsService.setUserDecryptionOptionsById).toHaveBeenCalledWith(
            userId,
            userDecryptionOptions,
          );
          expect(kdfConfigService.setKdfConfig).toHaveBeenCalledWith(userId, credentials.kdfConfig);
          expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(
            credentials.newMasterKey,
            userId,
          );
          expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
            masterKeyEncryptedUserKey[1],
            userId,
          );
          expect(keyService.setUserKey).toHaveBeenCalledWith(masterKeyEncryptedUserKey[0], userId);
        });

        it("should NOT set the private key to state", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(
            accountCryptographicStateService.setAccountCryptographicState,
          ).not.toHaveBeenCalled();
        });

        it("should set the local master key hash to state", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
            credentials.newLocalMasterKeyHash,
            userId,
          );
        });

        it("should create and set master password unlock data to prevent race condition with sync", async () => {
          // Arrange
          setupMocks({ ...defaultMockConfig, userType });

          const mockUnlockData = {
            salt: credentials.salt,
            kdf: credentials.kdfConfig,
            masterKeyWrappedUserKey: "wrapped_key_string",
          };

          masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(
            mockUnlockData as any,
          );

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
            credentials.newPassword,
            credentials.kdfConfig,
            credentials.salt,
            masterKeyEncryptedUserKey[0],
          );
          expect(masterPasswordService.setMasterPasswordUnlockData).toHaveBeenCalledWith(
            mockUnlockData,
            userId,
          );
        });

        describe("given resetPasswordAutoEnroll is true", () => {
          it(`should handle reset password (account recovery) auto enroll`, async () => {
            // Arrange
            credentials.resetPasswordAutoEnroll = true;

            setupMocks({ ...defaultMockConfig, userType, resetPasswordAutoEnroll: true });

            // Act
            await sut.setInitialPassword(credentials, userType, userId);

            // Assert
            expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
            expect(
              organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
            ).toHaveBeenCalledWith(credentials.orgId, userId, enrollmentRequest);
          });
        });

        describe("given resetPasswordAutoEnroll is false", () => {
          it(`should NOT handle reset password (account recovery) auto enroll`, async () => {
            // Arrange
            setupMocks({ ...defaultMockConfig, userType });

            // Act
            await sut.setInitialPassword(credentials, userType, userId);

            // Assert
            expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
            expect(
              organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
            ).not.toHaveBeenCalled();
          });
        });
      });
    });
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

      request = UpdateTdeOffboardingPasswordRequest.newConstructorWithHint(
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
        userId = null;

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

  /**
   * @deprecated To be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("setInitialPasswordTdeOffboardingOld(...)", () => {
    // Mock function parameters
    let credentials: SetInitialPasswordTdeOffboardingCredentialsOld;

    beforeEach(() => {
      // Mock function parameters
      credentials = {
        newMasterKey: new SymmetricCryptoKey(new Uint8Array(32).buffer as CsprngArray) as MasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newPasswordHint: "newPasswordHint",
      };
    });

    function setupTdeOffboardingMocks() {
      keyService.userKey$.mockReturnValue(of(userKey));
      keyService.encryptUserKeyWithMasterKey.mockResolvedValue(masterKeyEncryptedUserKey);
    }

    it("should successfully set an initial password for the TDE offboarding user", async () => {
      // Arrange
      setupTdeOffboardingMocks();

      const request = new UpdateTdeOffboardingPasswordRequest();
      request.key = masterKeyEncryptedUserKey[1].encryptedString;
      request.newMasterPasswordHash = credentials.newServerMasterKeyHash;
      request.masterPasswordHint = credentials.newPasswordHint;

      // Act
      await sut.setInitialPasswordTdeOffboardingOld(credentials, userId);

      // Assert
      expect(masterPasswordApiService.putUpdateTdeOffboardingPassword).toHaveBeenCalledTimes(1);
      expect(masterPasswordApiService.putUpdateTdeOffboardingPassword).toHaveBeenCalledWith(
        request,
      );
    });

    describe("given the initial password has been successfully set", () => {
      it("should clear the ForceSetPasswordReason by setting it to None", async () => {
        // Arrange
        setupTdeOffboardingMocks();

        // Act
        await sut.setInitialPasswordTdeOffboardingOld(credentials, userId);

        // Assert
        expect(masterPasswordApiService.putUpdateTdeOffboardingPassword).toHaveBeenCalledTimes(1);
        expect(masterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
          ForceSetPasswordReason.None,
          userId,
        );
      });
    });

    describe("general error handling", () => {
      ["newMasterKey", "newServerMasterKeyHash", "newPasswordHint"].forEach((key) => {
        it(`should throw if ${key} is not provided on the SetInitialPasswordTdeOffboardingCredentials object`, async () => {
          // Arrange
          const invalidCredentials: SetInitialPasswordTdeOffboardingCredentialsOld = {
            ...credentials,
            [key]: null,
          };

          // Act
          const promise = sut.setInitialPasswordTdeOffboardingOld(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(`${key} not found. Could not set password.`);
        });
      });

      it(`should throw if the userId was not passed in`, async () => {
        // Arrange
        userId = null;

        // Act
        const promise = sut.setInitialPasswordTdeOffboardingOld(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow("userId not found. Could not set password.");
      });

      it(`should throw if the userKey was not found`, async () => {
        // Arrange
        keyService.userKey$.mockReturnValue(of(null));

        // Act
        const promise = sut.setInitialPasswordTdeOffboardingOld(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow("userKey not found. Could not set password.");
      });

      it(`should throw if a newMasterKeyEncryptedUserKey was not returned`, async () => {
        // Arrange
        masterKeyEncryptedUserKey[1].encryptedString = "" as EncryptedString;

        setupTdeOffboardingMocks();

        // Act
        const promise = sut.setInitialPasswordTdeOffboardingOld(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow(
          "newMasterKeyEncryptedUserKey not found. Could not set password.",
        );
      });
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

      expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString(sdkRegistrationResult.master_password_unlock.masterKeyWrappedUserKey),
        userId,
      );

      expect(masterPasswordService.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
        credentials.newPassword,
        MasterPasswordUnlockData.fromSdk(sdkRegistrationResult.master_password_unlock),
        userId,
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
        userId = null;

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
        expect(masterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
          new EncString(unlockData.masterKeyWrappedUserKey),
          userId,
        );
        expect(masterPasswordService.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
          credentials.newPassword,
          unlockData,
          userId,
        );
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
          enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;
        });

        it("should throw if organization keys are not found", async () => {
          // Arrange
          organizationApiService.getKeys.mockResolvedValue(null);

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            "Organization keys response is null. Could not handle reset password auto enroll.",
          );
        });

        it("should throw if orgPublicKeyEncryptedUserKey is not found", async () => {
          // Arrange
          encryptService.encapsulateKeyUnsigned.mockResolvedValue(null);

          // Act
          const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(
            "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
          );
        });

        it("should throw if orgPublicKeyEncryptedUserKey.encryptedString is not found", async () => {
          // Arrange
          orgPublicKeyEncryptedUserKey.encryptedString = null;

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
