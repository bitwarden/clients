import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { PasswordInputResult } from "../input-password/password-input-result";

import { DefaultSetInitialPasswordService } from "./default-set-initial-password.service.implementation";
import {
  SetInitialPasswordCredentials,
  SetInitialPasswordUserType,
} from "./set-initial-password.service.abstraction";

describe("DefaultSetInitialPasswordService", () => {
  let sut: DefaultSetInitialPasswordService;

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

  it("should instantiate the DefaultSetPasswordJitService", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("setPassword", () => {
    let newMasterKey: MasterKey;
    let userKey: UserKey;
    let userKeyEncString: EncString;
    let protectedUserKey: [UserKey, EncString];
    let keyPair: [string, EncString];
    let keysRequest: KeysRequest;
    let organizationKeys: OrganizationKeysResponse;
    let orgPublicKey: Uint8Array;

    let orgSsoIdentifier: string;
    let orgId: string;
    let resetPasswordAutoEnroll: boolean;
    let userId: UserId;
    let userType: SetInitialPasswordUserType;
    let passwordInputResult: PasswordInputResult;
    let credentials: SetInitialPasswordCredentials;

    let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;
    let setPasswordRequest: SetPasswordRequest;

    beforeEach(() => {
      newMasterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");
      protectedUserKey = [userKey, userKeyEncString];
      keyPair = ["publicKey", new EncString("privateKey")];
      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);
      organizationKeys = {
        privateKey: "orgPrivateKey",
        publicKey: "orgPublicKey",
      } as OrganizationKeysResponse;
      orgPublicKey = Utils.fromB64ToArray(organizationKeys.publicKey);

      orgSsoIdentifier = "orgSsoIdentifier";
      orgId = "orgId";
      resetPasswordAutoEnroll = false;
      userId = "userId" as UserId;
      userType = SetInitialPasswordUserType.JIT_PROVISIONED_MASTER_PASSWORD_ORG_USER;

      passwordInputResult = {
        newMasterKey: newMasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        newPasswordHint: "newPasswordHint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPassword: "password",
      };

      credentials = {
        newMasterKey: passwordInputResult.newMasterKey,
        newServerMasterKeyHash: passwordInputResult.newServerMasterKeyHash,
        newLocalMasterKeyHash: passwordInputResult.newLocalMasterKeyHash,
        newPasswordHint: passwordInputResult.newPasswordHint,
        kdfConfig: passwordInputResult.kdfConfig,
        orgSsoIdentifier,
        orgId,
        resetPasswordAutoEnroll,
      };

      userDecryptionOptionsSubject = new BehaviorSubject(null);
      userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;

      setPasswordRequest = new SetPasswordRequest(
        passwordInputResult.newServerMasterKeyHash,
        protectedUserKey[1].encryptedString,
        passwordInputResult.newPasswordHint,
        orgSsoIdentifier,
        keysRequest,
        passwordInputResult.kdfConfig.kdfType,
        passwordInputResult.kdfConfig.iterations,
      );
    });

    function setupSetPasswordMocks(hasUserKey = true) {
      if (!hasUserKey) {
        keyService.userKey$.mockReturnValue(of(null));
        keyService.makeUserKey.mockResolvedValue(protectedUserKey);
      } else {
        keyService.userKey$.mockReturnValue(of(userKey));
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue(protectedUserKey);
      }

      keyService.makeKeyPair.mockResolvedValue(keyPair);

      masterPasswordApiService.setPassword.mockResolvedValue(undefined);
      masterPasswordService.setForceSetPasswordReason.mockResolvedValue(undefined);

      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
      userDecryptionOptionsService.setUserDecryptionOptions.mockResolvedValue(undefined);
      kdfConfigService.setKdfConfig.mockResolvedValue(undefined);
      keyService.setUserKey.mockResolvedValue(undefined);

      keyService.setPrivateKey.mockResolvedValue(undefined);

      masterPasswordService.setMasterKeyHash.mockResolvedValue(undefined);
    }

    function setupResetPasswordAutoEnrollMocks(organizationKeysExist = true) {
      if (organizationKeysExist) {
        organizationApiService.getKeys.mockResolvedValue(organizationKeys);
      } else {
        organizationApiService.getKeys.mockResolvedValue(null);
        return;
      }

      keyService.userKey$.mockReturnValue(of(userKey));
      encryptService.rsaEncrypt.mockResolvedValue(userKeyEncString);

      organizationUserApiService.putOrganizationUserResetPasswordEnrollment.mockResolvedValue(
        undefined,
      );
    }

    it("should set password successfully (given a user key)", async () => {
      // Arrange
      setupSetPasswordMocks();

      // Act
      await sut.setInitialPassword(credentials, userType, userId);

      // Assert
      expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
    });

    it("should set password successfully (given no user key)", async () => {
      // Arrange
      setupSetPasswordMocks(false);

      // Act
      await sut.setInitialPassword(credentials, userType, userId);

      // Assert
      expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
    });

    it("should handle reset password auto enroll", async () => {
      // Arrange
      credentials.resetPasswordAutoEnroll = true;

      setupSetPasswordMocks();
      setupResetPasswordAutoEnrollMocks();

      // Act
      await sut.setInitialPassword(credentials, userType, userId);

      // Assert
      expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
      expect(organizationApiService.getKeys).toHaveBeenCalledWith(orgId);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(userKey, orgPublicKey);
      expect(
        organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
      ).toHaveBeenCalled();
    });

    it("when handling reset password auto enroll, it should throw an error if organization keys are not found", async () => {
      // Arrange
      credentials.resetPasswordAutoEnroll = true;

      setupSetPasswordMocks();
      setupResetPasswordAutoEnrollMocks(false);

      // Act and Assert
      await expect(sut.setInitialPassword(credentials, userType, userId)).rejects.toThrow();
      expect(
        organizationUserApiService.putOrganizationUserResetPasswordEnrollment,
      ).not.toHaveBeenCalled();
    });
  });
});
