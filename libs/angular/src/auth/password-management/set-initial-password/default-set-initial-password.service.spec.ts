import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

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
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey, UserPrivateKey, UserPublicKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { DefaultSetInitialPasswordService } from "./default-set-initial-password.service.implementation";
import {
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
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
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

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
      userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;

      setPasswordRequest = new SetPasswordRequest(
        credentials.newServerMasterKeyHash,
        masterKeyEncryptedUserKey[1].encryptedString,
        credentials.newPasswordHint,
        credentials.orgSsoIdentifier,
        keysRequest,
        credentials.kdfConfig.kdfType,
        credentials.kdfConfig.iterations,
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

      // Mock handleResetPasswordAutoEnroll() values
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
        });

        it("should update account decryption properties", async () => {
          // Arrange
          setupMocks();

          // Act
          await sut.setInitialPassword(credentials, userType, userId);

          // Assert
          expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
          expect(userDecryptionOptionsService.setUserDecryptionOptions).toHaveBeenCalledWith(
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
          expect(keyService.setPrivateKey).toHaveBeenCalledWith(keyPair[1].encryptedString, userId);
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
          expect(userDecryptionOptionsService.setUserDecryptionOptions).toHaveBeenCalledWith(
            userDecryptionOptions,
          );
          expect(kdfConfigService.setKdfConfig).toHaveBeenCalledWith(userId, credentials.kdfConfig);
          expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(
            credentials.newMasterKey,
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
          expect(keyService.setPrivateKey).not.toHaveBeenCalled();
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

  describe("setInitialPasswordTdeOffboarding(...)", () => {
    // Mock function parameters
    let credentials: SetInitialPasswordTdeOffboardingCredentials;

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
      await sut.setInitialPasswordTdeOffboarding(credentials, userId);

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
        await sut.setInitialPasswordTdeOffboarding(credentials, userId);

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
          const invalidCredentials: SetInitialPasswordTdeOffboardingCredentials = {
            ...credentials,
            [key]: null,
          };

          // Act
          const promise = sut.setInitialPasswordTdeOffboarding(invalidCredentials, userId);

          // Assert
          await expect(promise).rejects.toThrow(`${key} not found. Could not set password.`);
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

      it(`should throw if a newMasterKeyEncryptedUserKey was not returned`, async () => {
        // Arrange
        masterKeyEncryptedUserKey[1].encryptedString = "" as EncryptedString;

        setupTdeOffboardingMocks();

        // Act
        const promise = sut.setInitialPasswordTdeOffboarding(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow(
          "newMasterKeyEncryptedUserKey not found. Could not set password.",
        );
      });
    });
  });
});
