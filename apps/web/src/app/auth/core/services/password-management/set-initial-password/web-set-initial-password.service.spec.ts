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
import { SetInitialPasswordRequest } from "@bitwarden/common/auth/models/request/set-initial-password.request";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
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
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  EncryptService,
  EncString,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { UnlockService } from "@bitwarden/unlock";
import { RouterService } from "@bitwarden/web-vault/app/core";

import { WebSetInitialPasswordService } from "./web-set-initial-password.service";

describe("WebSetInitialPasswordService", () => {
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
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let routerService: MockProxy<RouterService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;
  let registerSdkService: MockProxy<RegisterSdkService>;
  let unlockService: MockProxy<UnlockService>;

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
    organizationInviteService = mock<OrganizationInviteService>();
    routerService = mock<RouterService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    registerSdkService = mock<RegisterSdkService>();
    unlockService = mock<UnlockService>();

    sut = new WebSetInitialPasswordService(
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
      organizationInviteService,
      routerService,
      accountCryptographicStateService,
      registerSdkService,
      unlockService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  /**
   * @deprecated use `initializePasswordJitPasswordUserV2Encryption()` instead
   *
   * When you remove this, check also if there are any imports/properties
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
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;
    let setInitialPasswordRequest: SetInitialPasswordRequest;

    beforeEach(() => {
      // Mock function parameters
      credentials = {
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
      userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      userKeyEncString = new EncString("masterKeyEncryptedUserKey");
      masterKeyEncryptedUserKey = [userKey, userKeyEncString];

      keyPair = ["publicKey", new EncString("privateKey")];
      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString!);

      userDecryptionOptions = new UserDecryptionOptions({ hasMasterPassword: true });
      userDecryptionOptionsSubject = new BehaviorSubject(userDecryptionOptions);
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        userDecryptionOptionsSubject,
      );

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

      setInitialPasswordRequest = new SetInitialPasswordRequest(
        authenticationData,
        unlockData,
        credentials.newPasswordHint,
        credentials.orgSsoIdentifier,
        keysRequest,
      );
    });

    function setupMocks() {
      // Mock makeMasterKeyEncryptedUserKey() values
      keyService.userKey$.mockReturnValue(of(userKey));
      legacyCompatKeyService.encryptUserKeyWithMasterKey.mockResolvedValue(
        masterKeyEncryptedUserKey,
      );

      // Mock keyPair values
      keyService.userPrivateKey$.mockReturnValue(of(null));
      keyService.userPublicKey$.mockReturnValue(of(null));
      legacyCompatKeyService.makeKeyPair.mockResolvedValue(keyPair);
    }

    describe("given the initial password was successfully set", () => {
      it("should call routerService.getAndClearLoginRedirectUrl()", async () => {
        // Arrange
        setupMocks();

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(
          setInitialPasswordRequest,
        );
        expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
      });

      it("should call acceptOrganizationInviteService.clearOrganizationInvite()", async () => {
        // Arrange
        setupMocks();

        // Act
        await sut.setInitialPassword(credentials, userType, userId);

        // Assert
        expect(masterPasswordApiService.setPassword).toHaveBeenCalledWith(
          setInitialPasswordRequest,
        );
        expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalledTimes(1);
      });
    });

    describe("given the initial password was NOT successfully set (due to some error in setInitialPassword())", () => {
      it("should NOT call routerService.getAndClearLoginRedirectUrl()", async () => {
        // Arrange
        credentials.newPassword = null as unknown as string; // will trigger an error in setInitialPassword()
        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow();
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
        expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      });

      it("should NOT call acceptOrganizationInviteService.clearOrganizationInvite()", async () => {
        // Arrange
        credentials.newPassword = null as unknown as string; // will trigger an error in setInitialPassword()
        setupMocks();

        // Act
        const promise = sut.setInitialPassword(credentials, userType, userId);

        // Assert
        await expect(promise).rejects.toThrow();
        expect(masterPasswordApiService.setPassword).not.toHaveBeenCalled();
        expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
      });
    });
  });

  describe("initializePasswordJitPasswordUserV2Encryption(...)", () => {
    it("should call routerService.getAndClearLoginRedirectUrl() and organizationInviteService.clearOrganizationInvite()", async () => {
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
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalledTimes(1);

      superSpy.mockRestore();
    });
  });
});
