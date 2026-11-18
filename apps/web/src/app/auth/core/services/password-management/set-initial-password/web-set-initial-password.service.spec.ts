import { MockProxy, mock } from "jest-mock-extended";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordService,
} from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { FakeUserDecryptionOptions as InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import {
  DirectOrganizationInvite,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
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

  const stashedOrgInvite = new DirectOrganizationInvite({
    organizationId: "org-id",
    token: "token",
    email: "test@example.com",
    organizationUserId: "org-user-id",
    initOrganization: false,
    orgSsoIdentifier: "sso-id",
    orgUserHasExistingUser: false,
    organizationName: "org-name",
  });

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

  describe("initializePasswordJitPasswordUserV2Encryption(...)", () => {
    const credentials: InitializeJitPasswordCredentials = {
      newPasswordHint: "newPasswordHint",
      orgSsoIdentifier: "orgSsoIdentifier",
      orgId: "orgId" as OrganizationId,
      resetPasswordAutoEnroll: false,
      newPassword: "newPassword123!",
      salt: "user@example.com" as MasterPasswordSalt,
    };
    const userId = "userId" as UserId;

    let superSpy: jest.SpyInstance;

    beforeEach(() => {
      superSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(sut)),
          "initializePasswordJitPasswordUserV2Encryption",
        )
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      superSpy.mockRestore();
    });

    it("should call routerService.getAndClearLoginRedirectUrl() and organizationInviteService.clearOrganizationInvite() when an org invite is stashed", async () => {
      // Arrange
      organizationInviteService.getOrganizationInvite.mockResolvedValue(stashedOrgInvite);

      // Act
      await sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      // Assert
      expect(superSpy).toHaveBeenCalledWith(credentials, userId);
      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalledTimes(1);
    });

    it("should NOT clear the login redirect URL or the org invite when no org invite is stashed", async () => {
      // Arrange
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      // Act
      await sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      // Assert
      expect(superSpy).toHaveBeenCalledWith(credentials, userId);
      expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
    });
  });
});
