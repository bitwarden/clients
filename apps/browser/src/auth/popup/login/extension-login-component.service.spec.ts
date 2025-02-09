import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserPlatformUtilsService } from "../../../platform/services/platform-utils/browser-platform-utils.service";
import { ExtensionAnonLayoutWrapperDataService } from "../extension-anon-layout-wrapper/extension-anon-layout-wrapper-data.service";

import { ExtensionLoginComponentService } from "./extension-login-component.service";
import { BehaviorSubject } from "rxjs";

jest.mock("../../../platform/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("ExtensionLoginComponentService", () => {
  const baseUrl = "https://webvault.bitwarden.com/#/sso";
  let service: ExtensionLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<BrowserPlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let extensionAnonLayoutWrapperDataService: MockProxy<ExtensionAnonLayoutWrapperDataService>;
  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<BrowserPlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    extensionAnonLayoutWrapperDataService = mock<ExtensionAnonLayoutWrapperDataService>();
    environmentService.environment$ = new BehaviorSubject<Environment>({
      getWebVaultUrl: () => baseUrl,
    } as Environment);

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
            ),
        },
        { provide: DefaultLoginComponentService, useExisting: ExtensionLoginComponentService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
      ],
    });
    service = TestBed.inject(ExtensionLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("redirectToSso", () => {
    it("launches SSO browser window with correct URL", async () => {
      const email = "test@bitwarden.com";
      const state = "testState:clientId=browser";
      const codeVerifier = "testCodeVerifier";
      const codeChallenge = "testCodeChallenge";
      const expectedRedirectUri = "https://webvault.bitwarden.com/sso-connector.html";

      passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
      passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
      jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

      await service.redirectToSsoLogin(email);

      const expectedUrl = `${baseUrl}?clientId=browser&redirectUri=${encodeURIComponent(expectedRedirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

      expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
      expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(expectedUrl);
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
