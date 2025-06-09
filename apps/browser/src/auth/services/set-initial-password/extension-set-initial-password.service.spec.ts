import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { SetInitialPasswordService } from "@bitwarden/auth/angular";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { postLogoutMessageListener$ } from "../../../auth/popup/utils/post-logout-message-listener";

import { ExtensionSetInitialPasswordService } from "./extension-set-initial-password.service";

// Mock the module providing postLogoutMessageListener$
jest.mock("../../../auth/popup/utils/post-logout-message-listener.ts", () => {
  return {
    postLogoutMessageListener$: new BehaviorSubject<string>(""), // Replace with mock subject
  };
});

describe("ExtensionSetInitialPasswordService", () => {
  let sut: SetInitialPasswordService;

  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let messagingService: MockProxy<MessagingService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let router: MockProxy<Router>;

  let postLogoutMessageSubject: BehaviorSubject<string>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    messagingService = mock<MessagingService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    router = mock<Router>();

    // Cast postLogoutMessageListener$ to BehaviorSubject for dynamic control
    postLogoutMessageSubject = postLogoutMessageListener$ as BehaviorSubject<string>;

    sut = new ExtensionSetInitialPasswordService(
      apiService,
      encryptService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      messagingService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
      router,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("logoutAndOptionallyNavigate()", () => {
    it("should logout the user via the messagingService and route to '/' if postLogoutMessageListener$ emits 'switchAccountFinish'", async () => {
      // Arrange
      postLogoutMessageSubject.next("switchAccountFinish");

      // Act
      await sut.logoutAndOptionallyNavigate();

      // Assert
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("logout");
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should simply logout the user via the messagingService if postLogoutMessageListener$ emits 'doneLoggingOut'", async () => {
      // Arrange
      postLogoutMessageSubject.next("doneLoggingOut");

      // Act
      await sut.logoutAndOptionallyNavigate();

      // Assert
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("logout");
    });
  });
});
