import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import {
  EnvironmentService,
  Environment,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { DefaultLoginComponentService } from "./default-login-component.service";

jest.mock("@bitwarden/common/key-management/crypto/abstractions/crypto-function.service");
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

  describe("redirectToSsoLogin", () => {
    it("sets the pre-SSO state", async () => {
      const email = "test@bitwarden.com";
      const state = "testState";
      const codeVerifier = "testCodeVerifier";
      const codeChallenge = "testCodeChallenge";

      passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
      passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
      jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

      await service.redirectToSsoLogin(email);
      expect(ssoLoginService.setSsoEmail).toHaveBeenCalledWith(email);
      expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
      expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
    });
  });
});
