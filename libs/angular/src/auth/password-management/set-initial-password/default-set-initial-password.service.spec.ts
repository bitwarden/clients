/**
 * - Service
 *    - Should instantiate
 *
 * - setInitialPassword()
 *    - General
 *        - Should throw if credentials are missing properties (or if missing userId or userType)
 *    - JIT_PROVISIONED_MP_ORG_USER
 *    - TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP
 */

import { MockProxy, mock } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.

import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { SetPasswordCredentials } from "@bitwarden/auth/angular";
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import {
  DEFAULT_KDF_CONFIG,
  KdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";

import { DefaultSetInitialPasswordService } from "./default-set-initial-password.service.implementation";
import {
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
} from "./set-initial-password.service.abstraction";

describe("DefaultSetInitialPasswordService", () => {
  let sut: SetInitialPasswordService;

  let apiService: MockProxy<ApiService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();

    sut = new DefaultSetInitialPasswordService(
      apiService,
      masterPasswordApiService,
      keyService,
      encryptService,
      i18nService,
      kdfConfigService,
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
    let userId: UserId;

    // Mock other function data
    let userKey: UserKey;
    let userKeyEncString: EncString;
    let masterKeyEncryptedUserKey: [UserKey, EncString];
    let keyPair: [string, EncString];
    let keysRequest: KeysRequest;

    let userDecryptionOptions: UserDecryptionOptions;
    let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;
    let setPasswordRequest: SetPasswordRequest;

    beforeEach(() => {
      // Mock function parameters
      credentials = {
        newMasterKey: new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        newPasswordHint: "newPasswordHint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId",
        resetPasswordAutoEnroll: false,
      };
      userId = "userId" as UserId;
      userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;

      // Mock other function data
      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");
      masterKeyEncryptedUserKey = [userKey, userKeyEncString];
      keyPair = ["publicKey", new EncString("privateKey")];
      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);

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
    });

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
          const testFn = sut.setInitialPassword(invalidCredentials, userType, userId);

          // Assert
          await expect(testFn).rejects.toThrow(`${key} not found. Could not set password.`);
        });
      });

      ["userId", "userType"].forEach((param) => {
        it(`should throw if ${param} was not passed in`, async () => {
          // Arrange & Act
          const testFn = sut.setInitialPassword(
            credentials,
            param === "userType" ? null : userType,
            param === "userId" ? null : userId,
          );

          // Assert
          await expect(testFn).rejects.toThrow(`${param} not found. Could not set password.`);
        });
      });
    });

    describe("given SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER", () => {
      beforeEach(() => {
        userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;
      });

      it("should successfully set an initial password", async () => {
        // Arrange

        // Mock makeMasterKeyEncryptedUserKey() values
        keyService.userKey$.mockReturnValue(of(userKey));
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue(masterKeyEncryptedUserKey);

        // Mock keyPair values
        keyService.userPrivateKey$.mockReturnValue(of(null));
        keyService.userPublicKey$.mockReturnValue(of(null));
        keyService.makeKeyPair.mockResolvedValue(keyPair);

        // Mock updateAccountDecryptionProperties() calls
        // userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        // userDecryptionOptionsService.setUserDecryptionOptions.mockResolvedValue(undefined);

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
      });

      it("should throw if an encrypted private key is not found", () => {});

      describe("after setting the initial password", () => {
        it("should clear the ForceSetPasswordReason by setting it to None", () => {});

        it("should update account decryption properties", () => {});

        it("should set the local master key hash to state", () => {});
      });
    });

    describe("given SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP", () => {
      beforeEach(() => {
        userType = SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP;
      });

      it("should...", () => {});
    });
  });
});
