import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { DefaultSetInitialPasswordService } from "@bitwarden/angular/auth/password-management/set-initial-password/default-set-initial-password.service.implementation";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeUserWithPermissionCredentials,
} from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { FakeUserDecryptionOptions as InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  EncryptService,
  LegacyCompatKeyService,
} from "@bitwarden/legacy-crypto";
import { UnlockService } from "@bitwarden/unlock";

import { DesktopSetInitialPasswordService } from "./desktop-set-initial-password.service";

describe("DesktopSetInitialPasswordService", () => {
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
  let messagingService: MockProxy<MessagingService>;
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
    messagingService = mock<MessagingService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    registerSdkService = mock<RegisterSdkService>();
    unlockService = mock<UnlockService>();

    sut = new DesktopSetInitialPasswordService(
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
      messagingService,
      accountCryptographicStateService,
      registerSdkService,
      unlockService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("initializePasswordJitPasswordUserV2Encryption(...)", () => {
    it("should send a 'redrawMenu' message", async () => {
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
          DefaultSetInitialPasswordService.prototype,
          "initializePasswordJitPasswordUserV2Encryption",
        )
        .mockResolvedValue(undefined);

      // Act
      await sut.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

      // Assert
      expect(superSpy).toHaveBeenCalledWith(credentials, userId);
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");

      superSpy.mockRestore();
    });
  });

  describe("setInitialPasswordTdeUserWithPermission()", () => {
    let credentials: SetInitialPasswordTdeUserWithPermissionCredentials;
    let userId: UserId;
    let superSpy: jest.SpyInstance;

    beforeEach(() => {
      credentials = {
        newPassword: "newPassword123!",
        salt: "user@example.com" as MasterPasswordSalt,
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId" as OrganizationId,
        resetPasswordAutoEnroll: false,
      };
      userId = newGuid() as UserId;

      superSpy = jest
        .spyOn(
          DefaultSetInitialPasswordService.prototype,
          "setInitialPasswordTdeUserWithPermission",
        )
        .mockResolvedValue(undefined); // undefined = successful
    });

    afterEach(() => {
      superSpy.mockRestore();
    });

    it("should call the setInitialPasswordTdeUserWithPermission() method on the default service", async () => {
      // Act
      await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

      // Assert
      expect(superSpy).toHaveBeenCalledWith(credentials, userId);
    });

    describe("given the initial password was successfully set", () => {
      it("should send a 'redrawMenu' message", async () => {
        // Act
        await sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        expect(messagingService.send).toHaveBeenCalledTimes(1);
        expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
      });
    });

    describe("given the initial password was NOT successfully set (due an error on the default service)", () => {
      it("should NOT send a 'redrawMenu' message", async () => {
        // Arrange
        const error = new Error("error on DefaultSetInitialPasswordService");
        superSpy.mockRejectedValue(error);

        // Act
        const promise = sut.setInitialPasswordTdeUserWithPermission(credentials, userId);

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(messagingService.send).not.toHaveBeenCalled();
      });
    });
  });
});
