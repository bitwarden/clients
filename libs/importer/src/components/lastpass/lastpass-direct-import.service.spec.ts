import { NgZone } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import * as oauth from "oauth4webapi";
import { of, Subject } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";

import { LastPassPasswordPromptComponent } from "./dialog/lastpass-password-prompt.component";
import { LastPassDirectImportUIService } from "./lastpass-direct-import-ui.service";
import { LastPassDirectImportService } from "./lastpass-direct-import.service";
import { LastPassLoginSession } from "./lastpass-login-session";

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

    it("does not publish a flow, or log an error, for a login the user already left", async () => {
      const session = mock<LastPassLoginSession>({ userLeft: true });

      await expect(
        (service as any).createOidcSigninRequest("user@example.com", session),
      ).rejects.toThrow("SSO auth cancelled");

      expect((service as any).oidcFlow).toBeUndefined();
      expect(logService.error).not.toHaveBeenCalled();
    });

    it("still logs a failure for a login the user has not left", async () => {
      const session = mock<LastPassLoginSession>({ userLeft: false });
      mockedOauth.discoveryRequest.mockRejectedValue(new Error("network down"));

      await expect(
        (service as any).createOidcSigninRequest("user@example.com", session),
      ).rejects.toThrow("network down");

      expect(logService.error).toHaveBeenCalledWith("Unable to generate OIDC sign in request");
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

  describe("handleImport", () => {
    const EMAIL = "user@example.com";
    let vault: {
      userType: { isFederated: jest.Mock };
      setUserTypeContext: jest.Mock;
      open: jest.Mock;
      openFederated: jest.Mock;
      accountsToExportedCsvString: jest.Mock;
    };

    const sessionWith = (userLeft = false) => mock<LastPassLoginSession>({ userLeft });
    const flush = () => new Promise((resolve) => setTimeout(resolve));

    beforeEach(() => {
      appIdService.getAppId.mockResolvedValue("app-id");
      cryptoFunctionService.hash.mockResolvedValue(new Uint8Array([1, 2, 3]));
      vault = {
        userType: { isFederated: jest.fn().mockReturnValue(false) },
        setUserTypeContext: jest.fn().mockResolvedValue(undefined),
        open: jest.fn().mockResolvedValue(undefined),
        openFederated: jest.fn().mockResolvedValue(undefined),
        accountsToExportedCsvString: jest.fn().mockReturnValue("csv"),
      };
      (service as any).vault = vault;
    });

    describe("without a session", () => {
      it("asks for the password in a dialog and hands MFA to the dialog UI service", async () => {
        const passwordPrompt = jest
          .spyOn(LastPassPasswordPromptComponent, "open")
          .mockResolvedValue("hunter2");

        const csv = await service.handleImport(EMAIL, false);

        expect(passwordPrompt).toHaveBeenCalledWith(dialogService);
        expect(vault.open).toHaveBeenCalledWith(
          EMAIL,
          "hunter2",
          expect.anything(),
          lastPassDirectImportUIService,
          { parseSecureNotesToAccount: false },
        );
        expect(csv).toBe("csv");
      });

      it("waits for SSO behind a dialog", async () => {
        vault.userType.isFederated.mockReturnValue(true);
        jest
          .spyOn(service as any, "createOidcSigninRequest")
          .mockResolvedValue({ url: "https://idp.example.com/auth" });
        dialogService.openSimpleDialogRef.mockReturnValue({
          closed: new Subject(),
          close: jest.fn(),
        } as any);

        const login = (service as any).handleFederatedLogin(EMAIL);
        await flush();
        (service as any)._ssoImportCallback$.next({ oidcCode: "code", oidcState: "state" });

        await expect(login).resolves.toEqual({ oidcCode: "code", oidcState: "state" });
        expect(dialogService.openSimpleDialogRef).toHaveBeenCalledTimes(1);
        expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://idp.example.com/auth");
      });
    });

    describe("with a session", () => {
      let passwordPrompt: jest.SpyInstance;

      beforeEach(() => {
        passwordPrompt = jest.spyOn(LastPassPasswordPromptComponent, "open");
      });

      it("asks the session for the password and hands it MFA, never opening a dialog", async () => {
        const session = sessionWith();
        session.promptForPassword.mockResolvedValue("hunter2");

        const csv = await service.handleImport(EMAIL, false, session);

        expect(session.promptForPassword).toHaveBeenCalledWith({ previousPasswordRejected: false });
        expect(vault.open).toHaveBeenCalledWith(EMAIL, "hunter2", expect.anything(), session, {
          parseSecureNotesToAccount: false,
        });
        expect(passwordPrompt).not.toHaveBeenCalled();
        expect(vault.accountsToExportedCsvString).toHaveBeenCalledWith(true);
        expect(csv).toBe("csv");
      });

      it("includes shared folders when asked to", async () => {
        const session = sessionWith();
        session.promptForPassword.mockResolvedValue("hunter2");

        await service.handleImport(EMAIL, true, session);

        expect(vault.accountsToExportedCsvString).toHaveBeenCalledWith(false);
      });

      it("asks for the password again, flagged as rejected, after a wrong one", async () => {
        const session = sessionWith();
        session.promptForPassword.mockResolvedValueOnce("wrong").mockResolvedValueOnce("right");
        vault.open.mockRejectedValueOnce("Invalid password");

        await service.handleImport(EMAIL, false, session);

        expect(session.promptForPassword).toHaveBeenNthCalledWith(1, {
          previousPasswordRejected: false,
        });
        expect(session.promptForPassword).toHaveBeenNthCalledWith(2, {
          previousPasswordRejected: true,
        });
        expect(vault.open).toHaveBeenCalledTimes(2);
        expect(vault.open).toHaveBeenLastCalledWith(
          EMAIL,
          "right",
          expect.anything(),
          session,
          expect.anything(),
        );
      });

      it.each(["Second factor code is incorrect", "Out of band authentication failed"])(
        "logs in again with the same password after a typed code fails with '%s'",
        async (message) => {
          const session = sessionWith();
          session.promptForPassword.mockResolvedValue("hunter2");
          session.rejectSubmittedCode.mockReturnValue(true);
          vault.open.mockRejectedValueOnce(message);

          await service.handleImport(EMAIL, false, session);

          expect(session.promptForPassword).toHaveBeenCalledTimes(1);
          expect(session.rejectSubmittedCode).toHaveBeenCalledTimes(1);
          expect(vault.open).toHaveBeenCalledTimes(2);
          expect(vault.open).toHaveBeenLastCalledWith(
            EMAIL,
            "hunter2",
            expect.anything(),
            session,
            expect.anything(),
          );
        },
      );

      it.each(["Second factor code is incorrect", "Out of band authentication failed"])(
        "ends the import, without logging in again, when '%s' follows no typed code",
        async (message) => {
          const session = sessionWith();
          session.promptForPassword.mockResolvedValue("hunter2");
          session.rejectSubmittedCode.mockReturnValue(false);
          vault.open.mockRejectedValue(message);

          await expect(service.handleImport(EMAIL, false, session)).rejects.toBe(message);

          expect(session.rejectSubmittedCode).toHaveBeenCalledTimes(1);
          expect(vault.open).toHaveBeenCalledTimes(1);
          expect(logService.error).toHaveBeenCalledWith("Unable to open LastPass vault");
        },
      );

      it("asks for the code again only as often as the user types one", async () => {
        const session = sessionWith();
        session.promptForPassword.mockResolvedValue("hunter2");
        session.rejectSubmittedCode.mockReturnValueOnce(true).mockReturnValueOnce(false);
        vault.open.mockRejectedValue("Second factor code is incorrect");

        await expect(service.handleImport(EMAIL, false, session)).rejects.toBe(
          "Second factor code is incorrect",
        );

        expect(vault.open).toHaveBeenCalledTimes(2);
      });

      it("ends the import on any other failure, without retrying", async () => {
        const session = sessionWith();
        session.promptForPassword.mockResolvedValue("hunter2");
        vault.open.mockRejectedValue(new Error("Invalid username"));

        await expect(service.handleImport(EMAIL, false, session)).rejects.toThrow(
          "Invalid username",
        );

        expect(vault.open).toHaveBeenCalledTimes(1);
        expect(logService.error).toHaveBeenCalledWith("Unable to open LastPass vault");
      });

      it("does not retry a rejection that came from the user leaving", async () => {
        const session = sessionWith(true);
        session.promptForPassword.mockResolvedValue("hunter2");
        vault.open.mockRejectedValue("Invalid password");

        await expect(service.handleImport(EMAIL, false, session)).rejects.toBe("Invalid password");

        expect(session.promptForPassword).toHaveBeenCalledTimes(1);
        expect(vault.open).toHaveBeenCalledTimes(1);
      });

      it("stops when the user leaves the password prompt", async () => {
        const session = sessionWith();
        session.promptForPassword.mockRejectedValue(new Error("Login cancelled by the user"));

        await expect(service.handleImport(EMAIL, false, session)).rejects.toThrow(
          "Login cancelled by the user",
        );

        expect(vault.open).not.toHaveBeenCalled();
      });

      describe("SSO", () => {
        beforeEach(() => {
          vault.userType.isFederated.mockReturnValue(true);
          jest
            .spyOn(service as any, "createOidcSigninRequest")
            .mockResolvedValue({ url: "https://idp.example.com/auth" });
        });

        it("captures the import page, opens the IdP, then returns once the callback arrives", async () => {
          const session = sessionWith();
          session.prepareSso.mockResolvedValue();
          session.waitForSsoCancel.mockReturnValue(new Promise<never>(() => undefined));

          const login = (service as any).handleFederatedLogin(EMAIL, session);
          await flush();
          (service as any)._ssoImportCallback$.next({ oidcCode: "code", oidcState: "state" });

          await expect(login).resolves.toEqual({ oidcCode: "code", oidcState: "state" });
          expect(session.prepareSso.mock.invocationCallOrder[0]).toBeLessThan(
            platformUtilsService.launchUri.mock.invocationCallOrder[0],
          );
          expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
            "https://idp.example.com/auth",
          );
          expect(session.completeSso).toHaveBeenCalledTimes(1);
          expect(dialogService.openSimpleDialogRef).not.toHaveBeenCalled();
        });

        it("drops the pending sign-in and rejects when the user leaves", async () => {
          const session = sessionWith();
          session.prepareSso.mockResolvedValue();
          session.waitForSsoCancel.mockRejectedValue(new Error("SSO auth cancelled"));
          (service as any).oidcFlow = { state: "state-xyz" };

          await expect((service as any).handleFederatedLogin(EMAIL, session)).rejects.toThrow(
            "SSO auth cancelled",
          );

          expect((service as any).oidcFlow).toBeUndefined();
          expect(session.completeSso).not.toHaveBeenCalled();
        });

        it("does not open the identity provider if the user left while the request was being built", async () => {
          const session = sessionWith();
          const flow = { state: "state-a" };
          (service as any).oidcFlow = flow;
          session.prepareSso.mockImplementation(async () => {
            (session as any).userLeft = true;
          });

          await expect((service as any).handleFederatedLogin(EMAIL, session)).rejects.toThrow(
            "SSO auth cancelled",
          );

          expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
          expect(session.waitForSsoCancel).not.toHaveBeenCalled();
          expect(session.completeSso).not.toHaveBeenCalled();
          expect((service as any).oidcFlow).toBeUndefined();
        });

        it("leaves a newer login's flow alone when it cancels", async () => {
          const session = sessionWith();
          const newerFlow = { state: "state-b" };
          (service as any).oidcFlow = { state: "state-a" };
          session.prepareSso.mockImplementation(async () => {
            (session as any).userLeft = true;
            (service as any).oidcFlow = newerFlow;
          });

          await expect((service as any).handleFederatedLogin(EMAIL, session)).rejects.toThrow(
            "SSO auth cancelled",
          );

          expect((service as any).oidcFlow).toBe(newerFlow);
        });

        it("leaves a newer login's flow alone when the wait is cancelled", async () => {
          const session = sessionWith();
          const newerFlow = { state: "state-b" };
          (service as any).oidcFlow = { state: "state-a" };
          session.prepareSso.mockResolvedValue();
          session.waitForSsoCancel.mockImplementation(async () => {
            (service as any).oidcFlow = newerFlow;
            throw new Error("SSO auth cancelled");
          });

          await expect((service as any).handleFederatedLogin(EMAIL, session)).rejects.toThrow(
            "SSO auth cancelled",
          );

          expect((service as any).oidcFlow).toBe(newerFlow);
        });

        it("hands the session to the federated login as its UI", async () => {
          const session = sessionWith();
          jest.spyOn(service as any, "processOidcSigninResponse").mockResolvedValue({
            id_token: "id",
            access_token: "access",
            profile: {},
            userState: { email: EMAIL },
          });

          await (service as any).handleFederatedImport("code", "state", false, session);

          expect(vault.openFederated).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            session,
            { parseSecureNotesToAccount: false },
          );
        });
      });
    });
  });
});
