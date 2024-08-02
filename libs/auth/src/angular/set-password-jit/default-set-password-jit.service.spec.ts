import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { DEFAULT_KDF_CONFIG } from "@bitwarden/common/auth/models/domain/kdf-config";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { PasswordInputResult } from "../input-password/password-input-result";

import { DefaultSetPasswordJitService } from "./default-set-password-jit.service";
import { SetPasswordCredentials } from "./set-password-jit.service.abstraction";

describe("DefaultSetPasswordJitService", () => {
  let sut: DefaultSetPasswordJitService;

  let apiService: MockProxy<ApiService>;
  let cryptoService: MockProxy<CryptoService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    cryptoService = mock<CryptoService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserService = mock<OrganizationUserService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();

    sut = new DefaultSetPasswordJitService(
      apiService,
      cryptoService,
      i18nService,
      kdfConfigService,
      masterPasswordService,
      organizationApiService,
      organizationUserService,
      userDecryptionOptionsService,
    );
  });

  it("should instantiate the DefaultSetPasswordJitService", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("setPassword", () => {
    let masterKey: MasterKey;
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
    let passwordInputResult: PasswordInputResult;
    let credentials: SetPasswordCredentials;

    let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;
    let setPasswordRequest: SetPasswordRequest;

    beforeEach(() => {
      masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
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

      passwordInputResult = {
        masterKey: masterKey,
        masterKeyHash: "masterKeyHash",
        localMasterKeyHash: "localMasterKeyHash",
        hint: "hint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        password: "password",
      };

      credentials = {
        ...passwordInputResult,
        orgSsoIdentifier,
        orgId,
        resetPasswordAutoEnroll,
        userId,
      };

      userDecryptionOptionsSubject = new BehaviorSubject(null);
      userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;

      setPasswordRequest = new SetPasswordRequest(
        passwordInputResult.masterKeyHash,
        protectedUserKey[1].encryptedString,
        passwordInputResult.hint,
        orgSsoIdentifier,
        keysRequest,
        passwordInputResult.kdfConfig.kdfType,
        passwordInputResult.kdfConfig.iterations,
      );
    });

    function setupSetPasswordMocks(hasUserKey = true) {
      if (!hasUserKey) {
        cryptoService.userKey$.mockReturnValue(of(null));
        cryptoService.makeUserKey.mockResolvedValue(protectedUserKey);
      } else {
        cryptoService.userKey$.mockReturnValue(of(userKey));
        cryptoService.encryptUserKeyWithMasterKey.mockResolvedValue(protectedUserKey);
      }

      cryptoService.makeKeyPair.mockResolvedValue(keyPair);

      apiService.setPassword.mockResolvedValue(undefined);
      masterPasswordService.setForceSetPasswordReason.mockResolvedValue(undefined);

      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
      userDecryptionOptionsService.setUserDecryptionOptions.mockResolvedValue(undefined);
      kdfConfigService.setKdfConfig.mockResolvedValue(undefined);
      cryptoService.setUserKey.mockResolvedValue(undefined);

      cryptoService.setPrivateKey.mockResolvedValue(undefined);

      masterPasswordService.setMasterKeyHash.mockResolvedValue(undefined);
    }

    function setupResetPasswordAutoEnrollMocks(organizationKeysExist = true) {
      if (organizationKeysExist) {
        organizationApiService.getKeys.mockResolvedValue(organizationKeys);
      } else {
        organizationApiService.getKeys.mockResolvedValue(null);
        return;
      }

      cryptoService.userKey$.mockReturnValue(of(userKey));
      cryptoService.rsaEncrypt.mockResolvedValue(userKeyEncString);

      organizationUserService.putOrganizationUserResetPasswordEnrollment.mockResolvedValue(
        undefined,
      );
    }

    it("should set password successfully (given a user key)", async () => {
      // Arrange
      setupSetPasswordMocks();

      // Act
      await sut.setPassword(credentials);

      // Assert
      expect(apiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
    });

    it("should set password successfully (given no user key)", async () => {
      // Arrange
      setupSetPasswordMocks(false);

      // Act
      await sut.setPassword(credentials);

      // Assert
      expect(apiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
    });

    it("should handle reset password auto enroll", async () => {
      // Arrange
      credentials.resetPasswordAutoEnroll = true;

      setupSetPasswordMocks();
      setupResetPasswordAutoEnrollMocks();

      // Act
      await sut.setPassword(credentials);

      // Assert
      expect(apiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
      expect(organizationApiService.getKeys).toHaveBeenCalledWith(orgId);
      expect(cryptoService.rsaEncrypt).toHaveBeenCalledWith(userKey.key, orgPublicKey);
      expect(organizationUserService.putOrganizationUserResetPasswordEnrollment).toHaveBeenCalled();
    });

    it("when handling reset password auto enroll, it should throw an error if organization keys are not found", async () => {
      // Arrange
      credentials.resetPasswordAutoEnroll = true;

      setupSetPasswordMocks();
      setupResetPasswordAutoEnrollMocks(false);

      // Act and Assert
      await expect(sut.setPassword(credentials)).rejects.toThrow();
      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment,
      ).not.toHaveBeenCalled();
    });
  });
});
