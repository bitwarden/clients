import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
} from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";
import { RouterService } from "@bitwarden/web-vault/app/core";

import { WebSetInitialPasswordService } from "./web-set-initial-password.service";

describe("WebSetInitialPasswordService", () => {
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
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let routerService: MockProxy<RouterService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;
  let registerSdkService: MockProxy<RegisterSdkService>;

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
    organizationInviteService = mock<OrganizationInviteService>();
    routerService = mock<RouterService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    registerSdkService = mock<RegisterSdkService>();

    sut = new WebSetInitialPasswordService(
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
      organizationInviteService,
      routerService,
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
        newMasterKey: new SymmetricCryptoKey(new Uint8Array(32).buffer as CsprngArray) as MasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        newPasswordHint: "newPasswordHint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId",
        resetPasswordAutoEnroll: false,
        newPassword: "Test@Password123!",
        salt: "user@example.com" as MasterPasswordSalt,
      };
      userId = "userId" as UserId;
      userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;

      // Mock other function data
      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("masterKeyEncryptedUserKey");
      masterKeyEncryptedUserKey = [userKey, userKeyEncString];

      keyPair = ["publicKey", new EncString("privateKey")];
      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);

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
    });

    function setupMocks() {
      // Mock makeMasterKeyEncryptedUserKey() values
      keyService.userKey$.mockReturnValue(of(userKey));
      keyService.encryptUserKeyWithMasterKey.mockResolvedValue(masterKeyEncryptedUserKey);

      // Mock keyPair values
      keyService.userPrivateKey$.mockReturnValue(of(null));
      keyService.userPublicKey$.mockReturnValue(of(null));
      keyService.makeKeyPair.mockResolvedValue(keyPair);
    }

    describe("given the initial password was successfully set", () => {
      it("should call routerService.getAndClearLoginRedirectUrl()", async () => {
        // Arrange
        setupMocks();

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
      });

      it("should call acceptOrganizationInviteService.clearOrganizationInvitation()", async () => {
        // Arrange
        setupMocks();

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(setPasswordRequest);
        expect(organizationInviteService.clearOrganizationInvitation).toHaveBeenCalledTimes(1);
      });
    });

    describe("given the initial password was NOT successfully set (due to some error in setInitialPassword())", () => {
      it("should NOT call routerService.getAndClearLoginRedirectUrl()", async () => {
        // Arrange
        credentials.newMasterKey = null; // will trigger an error in setInitialPassword()
        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow();
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
        expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      });

      it("should NOT call acceptOrganizationInviteService.clearOrganizationInvitation()", async () => {
        // Arrange
        credentials.newMasterKey = null; // will trigger an error in setInitialPassword()
        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow();
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
        expect(organizationInviteService.clearOrganizationInvitation).not.toHaveBeenCalled();
      });
    });
  });

  describe("initializePasswordJitPasswordUserV2Encryption(...)", () => {
    it("should call routerService.getAndClearLoginRedirectUrl() and organizationInviteService.clearOrganizationInvitation()", async () => {
      // Arrange
      const credentials: InitializeJitPasswordCredentials = {
        newPasswordHint: "newPasswordHint",
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId" as OrganizationId,
        resetPasswordAutoEnroll: false,
        newPassword: "newPassword123!",
        salt: "user@example.com" as MasterPasswordSalt,
      };
      const userId = "userId" as UserId;

      const superSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(sut)),
          "initializePasswordJitPasswordUserV2Encryption",
        )
        .mockResolvedValue(undefined);

      // Act
      await sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      // Assert
      expect(superSpy).toHaveBeenCalledWith(credentials, userId);
      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
      expect(organizationInviteService.clearOrganizationInvitation).toHaveBeenCalledTimes(1);

      superSpy.mockRestore();
    });
  });
});
