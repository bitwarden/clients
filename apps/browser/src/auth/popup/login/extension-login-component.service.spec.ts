import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoUrlService } from "@bitwarden/auth/common";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserPlatformUtilsService } from "../../../platform/services/platform-utils/browser-platform-utils.service";
import { ExtensionAnonLayoutWrapperDataService } from "../../../popup/components/extension-anon-layout-wrapper/extension-anon-layout-wrapper-data.service";

import { ExtensionLoginComponentService } from "./extension-login-component.service";

jest.mock("../../../platform/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("ExtensionLoginComponentService", () => {
  const baseUrl = "https://webvault.bitwarden.com";
  let service: ExtensionLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<BrowserPlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let extensionAnonLayoutWrapperDataService: MockProxy<ExtensionAnonLayoutWrapperDataService>;
  let ssoUrlService: MockProxy<SsoUrlService>;
  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<BrowserPlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    ssoUrlService = mock<SsoUrlService>();
    extensionAnonLayoutWrapperDataService = mock<ExtensionAnonLayoutWrapperDataService>();
    environmentService.environment$ = new BehaviorSubject<Environment>({
      getWebVaultUrl: () => baseUrl,
    } as Environment);
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ExtensionLoginComponentService,
          useFactory: () =>
            new ExtensionLoginComponentService(
              cryptoFunctionService,
              environmentService,
              passwordGenerationService,
              platformUtilsService,
              ssoLoginService,
              extensionAnonLayoutWrapperDataService,
              ssoUrlService,
            ),
        },
        { provide: DefaultLoginComponentService, useExisting: ExtensionLoginComponentService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
        {
          provide: ExtensionAnonLayoutWrapperDataService,
          useValue: extensionAnonLayoutWrapperDataService,
        },
        { provide: SsoUrlService, useValue: ssoUrlService },
      ],
    });
    service = TestBed.inject(ExtensionLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("redirectToSso", () => {
    it("launches SSO browser window", async () => {
      const email = "test@bitwarden.com";
      const state = "testState";
      const expectedState = "testState:clientId=browser";
      const codeVerifier = "testCodeVerifier";
      const codeChallenge = "testCodeChallenge";

      passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
      passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
      jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

      await service.redirectToSsoLogin(email);

      expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(expectedState);
      expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
      expect(platformUtilsService.launchUri).toHaveBeenCalled();
    });
  });

  describe("showBackButton", () => {
    it("sets showBackButton in extensionAnonLayoutWrapperDataService", () => {
      service.showBackButton(true);
      expect(extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData).toHaveBeenCalledWith({
        showBackButton: true,
      });
    });
  });
});
