import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import {
  EnvironmentService,
  Environment,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { DefaultLoginComponentService } from "./default-login-component.service";

jest.mock("@bitwarden/common/platform/abstractions/crypto-function.service");
jest.mock("@bitwarden/common/platform/abstractions/environment.service");
jest.mock("@bitwarden/common/platform/abstractions/platform-utils.service");
jest.mock("@bitwarden/common/auth/abstractions/sso-login.service.abstraction");
jest.mock("@bitwarden/generator-legacy");

describe("DefaultLoginComponentService", () => {
  let service: DefaultLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    platformUtilsService = mock<PlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();

    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://webvault.bitwarden.com",
      getRegion: () => "US",
      getUrls: () => ({}),
      isCloud: () => true,
      getApiUrl: () => "https://api.bitwarden.com",
    } as Environment);

    service = new DefaultLoginComponentService(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
  });

  it("creates without error", () => {
    expect(service).toBeTruthy();
  });

  describe("getOrgPolicies", () => {
    it("returns null", async () => {
      const result = await service.getOrgPolicies();
      expect(result).toBeNull();
    });
  });

  describe("isLoginWithPasskeySupported", () => {
    it("returns true when clientType is Web", () => {
      service["clientType"] = ClientType.Web;
      expect(service.isLoginWithPasskeySupported()).toBe(true);
    });

    it("returns false when clientType is not Web", () => {
      service["clientType"] = ClientType.Desktop;
      expect(service.isLoginWithPasskeySupported()).toBe(false);
    });
  });

  describe("launchSsoBrowserWindow", () => {
    const email = "test@bitwarden.com";
    let state = "testState";
    const codeVerifier = "testCodeVerifier";
    const codeChallenge = "testCodeChallenge";
    const baseUrl = "https://webvault.bitwarden.com/#/sso";

    beforeEach(() => {
      state = "testState";

      passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
      passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
      jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);
    });

    it.each([
      {
        clientType: ClientType.Browser,
        clientId: "browser",
        expectedRedirectUri: "https://webvault.bitwarden.com/sso-connector.html",
      },
      {
        clientType: ClientType.Desktop,
        clientId: "desktop",
        expectedRedirectUri: "bitwarden://sso-callback",
      },
    ])(
      "launches SSO browser window with correct URL for $clientId client",
      async ({ clientType, clientId, expectedRedirectUri }) => {
        service["clientType"] = clientType;

        await service.launchSsoBrowserWindow(email, clientId as "browser" | "desktop");

        if (clientType === ClientType.Browser) {
          state += ":clientId=browser";
        }

        const expectedUrl = `${baseUrl}?clientId=${clientId}&redirectUri=${encodeURIComponent(expectedRedirectUri)}&state=${state}&codeChallenge=${codeChallenge}&email=${encodeURIComponent(email)}`;

        expect(ssoLoginService.setSsoEmail).toHaveBeenCalledWith(email);
        expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
        expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(expectedUrl);
      },
    );
  });
});
