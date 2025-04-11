import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { SsoPreValidateResponse } from "@bitwarden/common/auth/models/response/sso-pre-validate.response";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  PasswordGenerationServiceAbstraction,
  PasswordGeneratorOptions,
} from "@bitwarden/generator-legacy";

import { LinkSsoService } from "./link-sso.service";

describe("LinkSsoService", () => {
  let sut: LinkSsoService;

  let mockSsoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let mockApiService: MockProxy<ApiService>;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;
  let mockPasswordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;

  const mockEnvironment$ = new BehaviorSubject<any>({
    getIdentityUrl: jest.fn().mockReturnValue("https://identity.bitwarden.com"),
  });

  beforeEach(() => {
    // Create mock implementations
    mockSsoLoginService = mock<SsoLoginServiceAbstraction>();
    mockApiService = mock<ApiService>();
    mockCryptoFunctionService = mock<CryptoFunctionService>();
    mockEnvironmentService = mock<EnvironmentService>();
    mockPasswordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();

    // Set up environment service to return our mock environment
    mockEnvironmentService.environment$ = mockEnvironment$;

    // Set up API service mocks
    const mockResponse = { Token: "mockSsoToken" };
    mockApiService.preValidateSso.mockResolvedValue(new SsoPreValidateResponse(mockResponse));
    mockApiService.getSsoUserIdentifier.mockResolvedValue("mockUserIdentifier");

    // Set up password generation service mock
    mockPasswordGenerationService.generatePassword.mockImplementation(
      async (options: PasswordGeneratorOptions) => {
        return "mockGeneratedPassword";
      },
    );

    // Set up crypto function service mock
    mockCryptoFunctionService.hash.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

    // Create the service under test with mock dependencies
    sut = new LinkSsoService(
      mockSsoLoginService,
      mockApiService,
      mockCryptoFunctionService,
      mockEnvironmentService,
      mockPasswordGenerationService,
      mockPlatformUtilsService,
    );

    // Mock Utils.fromBufferToUrlB64
    jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue("mockCodeChallenge");

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        origin: "https://bitwarden.com",
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("linkSso", () => {
    it("throws an error when identifier is null", async () => {
      await expect(sut.linkSso(null as unknown as string)).rejects.toThrow(
        "SSO identifier is required",
      );
    });

    it("throws an error when identifier is empty", async () => {
      await expect(sut.linkSso("")).rejects.toThrow("SSO identifier is required");
    });

    it("calls preValidateSso with the provided identifier", async () => {
      await sut.linkSso("org123");

      expect(mockApiService.preValidateSso).toHaveBeenCalledWith("org123");
    });

    it("generates a password for code verifier", async () => {
      await sut.linkSso("org123");

      expect(mockPasswordGenerationService.generatePassword).toHaveBeenCalledWith({
        type: "password",
        length: 64,
        uppercase: true,
        lowercase: true,
        number: true,
        special: false,
      });
    });

    it("sets the code verifier in the ssoLoginService", async () => {
      await sut.linkSso("org123");

      expect(mockSsoLoginService.setCodeVerifier).toHaveBeenCalledWith("mockGeneratedPassword");
    });

    it("generates a state and sets it in the ssoLoginService", async () => {
      await sut.linkSso("org123");

      const expectedState =
        "mockGeneratedPassword_returnUri='/settings/organizations'_identifier=org123";
      expect(mockSsoLoginService.setSsoState).toHaveBeenCalledWith(expectedState);
    });

    it("gets the SSO user identifier from the API", async () => {
      await sut.linkSso("org123");

      expect(mockApiService.getSsoUserIdentifier).toHaveBeenCalled();
    });

    it("launches the authorize URL with the correct parameters", async () => {
      await sut.linkSso("org123");

      expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining("https://identity.bitwarden.com/connect/authorize"),
        { sameWindow: true },
      );

      const launchUriArg = mockPlatformUtilsService.launchUri.mock.calls[0][0];
      expect(launchUriArg).toContain("client_id=web");
      expect(launchUriArg).toContain(
        "redirect_uri=https%3A%2F%2Fbitwarden.com%2Fsso-connector.html",
      );
      expect(launchUriArg).toContain("response_type=code");
      expect(launchUriArg).toContain("code_challenge=mockCodeChallenge");
      expect(launchUriArg).toContain("ssoToken=mockSsoToken");
      expect(launchUriArg).toContain("user_identifier=mockUserIdentifier");
    });
  });
});
