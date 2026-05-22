import { NgZone } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import * as oauth from "oauth4webapi";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { LastPassDirectImportUIService } from "./lastpass-direct-import-ui.service";
import { LastPassDirectImportService } from "./lastpass-direct-import.service";

jest.mock("oauth4webapi", () => ({
  __esModule: true,
  discoveryRequest: jest.fn(),
  processDiscoveryResponse: jest.fn(),
  generateRandomCodeVerifier: jest.fn(),
  generateRandomState: jest.fn(),
  generateRandomNonce: jest.fn(),
  calculatePKCECodeChallenge: jest.fn(),
  validateAuthResponse: jest.fn(),
  authorizationCodeGrantRequest: jest.fn(),
  processAuthorizationCodeResponse: jest.fn(),
  getValidatedIdTokenClaims: jest.fn(),
  userInfoRequest: jest.fn(),
  processUserInfoResponse: jest.fn(),
  None: jest.fn((): (() => void) => () => undefined),
}));

const mockedOauth = oauth as jest.Mocked<typeof oauth>;

const FAKE_AS: oauth.AuthorizationServer = {
  issuer: "https://idp.example.com",
  authorization_endpoint: "https://idp.example.com/authorize",
  token_endpoint: "https://idp.example.com/token",
  userinfo_endpoint: "https://idp.example.com/userinfo",
  jwks_uri: "https://idp.example.com/jwks",
};

describe("LastPassDirectImportService", () => {
  let service: LastPassDirectImportService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let appIdService: MockProxy<AppIdService>;
  let lastPassDirectImportUIService: MockProxy<LastPassDirectImportUIService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let broadcasterService: MockProxy<BroadcasterService>;
  let ngZone: MockProxy<NgZone>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    jest.clearAllMocks();

    cryptoFunctionService = mock<CryptoFunctionService>();
    appIdService = mock<AppIdService>();
    lastPassDirectImportUIService = mock<LastPassDirectImportUIService>();
    platformUtilsService = mock<PlatformUtilsService>();
    broadcasterService = mock<BroadcasterService>();
    ngZone = mock<NgZone>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    // Plain stubs (not jest-mock-extended proxies) for the rxjs/observable boundaries
    // because the proxy's Symbol traps interfere with rxjs's interop checks.
    const environment = {
      getWebVaultUrl: () => "https://vault.example.com",
    } as unknown as Environment;
    environmentService = {
      environment$: of(environment),
    } as unknown as MockProxy<EnvironmentService>;

    platformUtilsService.getClientType.mockReturnValue(ClientType.Web);

    service = new LastPassDirectImportService(
      cryptoFunctionService,
      environmentService,
      appIdService,
      lastPassDirectImportUIService,
      platformUtilsService,
      broadcasterService,
      ngZone,
      dialogService,
      i18nService,
      logService,
    );

    // Inject a stub vault.userType for the OIDC paths.
    (service as any).vault = {
      userType: {
        openIDConnectAuthorityBase: "https://idp.example.com",
        openIDConnectClientId: "client-123",
        oidcScope: "openid profile email",
      },
    };

    mockedOauth.discoveryRequest.mockResolvedValue({} as Response);
    mockedOauth.processDiscoveryResponse.mockResolvedValue(FAKE_AS);
    mockedOauth.generateRandomCodeVerifier.mockReturnValue("verifier-abc");
    mockedOauth.generateRandomState.mockReturnValue("state-xyz");
    mockedOauth.generateRandomNonce.mockReturnValue("nonce-456");
    mockedOauth.calculatePKCECodeChallenge.mockResolvedValue("challenge-def");
  });

  describe("createOidcSigninRequest", () => {
    it("discovers metadata against the configured authority", async () => {
      await (service as any).createOidcSigninRequest("user@example.com");

      const issuerArg = mockedOauth.discoveryRequest.mock.calls[0][0] as URL;
      expect(issuerArg.toString()).toBe("https://idp.example.com/");
      expect(mockedOauth.discoveryRequest.mock.calls[0][1]).toEqual({ algorithm: "oidc" });
    });

    it("builds an authorize URL with PKCE, state, and nonce", async () => {
      const { url } = await (service as any).createOidcSigninRequest("user@example.com");

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe("https://idp.example.com/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("client-123");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://vault.example.com/sso-connector.html?lp=1",
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("response_mode")).toBe("query");
      expect(parsed.searchParams.get("scope")).toBe("openid profile email");
      expect(parsed.searchParams.get("state")).toBe("state-xyz");
      expect(parsed.searchParams.get("nonce")).toBe("nonce-456");
      expect(parsed.searchParams.get("code_challenge")).toBe("challenge-def");
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    });

    it("uses the desktop deep-link redirect when running in desktop", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

      const { url } = await (service as any).createOidcSigninRequest("user@example.com");

      expect(new URL(url).searchParams.get("redirect_uri")).toBe("bitwarden://import-callback-lp");
    });

    it("stores flow state for the matching processOidcSigninResponse call", async () => {
      await (service as any).createOidcSigninRequest("user@example.com");

      const flow = (service as any).oidcFlow;
      expect(flow.codeVerifier).toBe("verifier-abc");
      expect(flow.state).toBe("state-xyz");
      expect(flow.nonce).toBe("nonce-456");
      expect(flow.userState).toEqual({ email: "user@example.com" });
    });
  });

  describe("processOidcSigninResponse", () => {
    beforeEach(async () => {
      await (service as any).createOidcSigninRequest("user@example.com");
    });

    it("throws when no sign-in request is in progress", async () => {
      (service as any).oidcFlow = undefined;

      await expect(
        (service as any).processOidcSigninResponse("code-1", "state-xyz"),
      ).rejects.toThrow("No OIDC sign in request is in progress.");
    });

    it("propagates state-mismatch errors from validateAuthResponse", async () => {
      mockedOauth.validateAuthResponse.mockImplementation(() => {
        throw new Error("state mismatch");
      });

      await expect(
        (service as any).processOidcSigninResponse("code-1", "wrong-state"),
      ).rejects.toThrow("state mismatch");
    });

    it("exchanges the code, fetches userinfo, and returns merged profile + userState", async () => {
      const callbackParams = new URLSearchParams({ code: "code-1", state: "state-xyz" });
      mockedOauth.validateAuthResponse.mockReturnValue(callbackParams);
      mockedOauth.authorizationCodeGrantRequest.mockResolvedValue({} as Response);
      mockedOauth.processAuthorizationCodeResponse.mockResolvedValue({
        access_token: "access-token-value",
        id_token: "id-token-value",
        token_type: "Bearer",
      } as any);
      mockedOauth.getValidatedIdTokenClaims.mockReturnValue({
        iss: FAKE_AS.issuer,
        aud: "client-123",
        sub: "subject-1",
        exp: 0,
        iat: 0,
        email: "user@example.com",
      });
      mockedOauth.userInfoRequest.mockResolvedValue({} as Response);
      mockedOauth.processUserInfoResponse.mockResolvedValue({
        sub: "subject-1",
        LastPassK1: "k1-bytes",
      } as any);

      const result = await (service as any).processOidcSigninResponse("code-1", "state-xyz");

      // Authenticated code-grant call uses the stored verifier + redirect URI.
      expect(mockedOauth.authorizationCodeGrantRequest).toHaveBeenCalledWith(
        FAKE_AS,
        expect.objectContaining({ client_id: "client-123" }),
        expect.any(Function), // oauth.None()
        callbackParams,
        "https://vault.example.com/sso-connector.html?lp=1",
        "verifier-abc",
      );
      // Nonce is validated against the stored value.
      expect(mockedOauth.processAuthorizationCodeResponse).toHaveBeenCalledWith(
        FAKE_AS,
        expect.objectContaining({ client_id: "client-123" }),
        expect.anything(),
        { expectedNonce: "nonce-456", requireIdToken: true },
      );
      // Userinfo is called with the access token.
      expect(mockedOauth.userInfoRequest).toHaveBeenCalledWith(
        FAKE_AS,
        expect.objectContaining({ client_id: "client-123" }),
        "access-token-value",
      );
      // Userinfo claims are merged over the ID token claims (preserves LastPassK1).
      expect(result).toEqual({
        id_token: "id-token-value",
        access_token: "access-token-value",
        profile: expect.objectContaining({
          sub: "subject-1",
          email: "user@example.com",
          LastPassK1: "k1-bytes",
        }),
        userState: { email: "user@example.com" },
      });
    });
  });
});
