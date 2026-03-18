import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  SsoUrlService,
  UserApiLoginCredentials,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import {
  TwoFactorService,
  TwoFactorApiService,
  TwoFactorProviderDetails,
} from "@bitwarden/common/auth/two-factor";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { KeyConnectorDomainConfirmation } from "@bitwarden/common/key-management/key-connector/models/key-connector-domain-confirmation";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { ConfirmKeyConnectorDomainCommand } from "../../key-management/confirm-key-connector-domain.command";
import { Response } from "../../models/response";

import { LoginCommand } from "./login.command";

// Mock NodeUtils.readFirstLine for passwordfile tests
jest.mock("@bitwarden/node/node-utils", () => ({
  NodeUtils: {
    readFirstLine: jest.fn().mockResolvedValue("filepass"),
  },
}));

// --- Helpers ---

// Commander passes null for omitted positional args at runtime, but the
// run() signature types them as string.  This alias keeps call sites readable.
const NULL = null as unknown as string;

const TEST_USER_ID = "test-user-id" as UserId;
const MOCK_SESSION_KEY = new Uint8Array(64) as CsprngArray;
const B64_SESSION_KEY = Utils.fromBufferToB64(MOCK_SESSION_KEY);

function mockSuccessAuthResult(userId: UserId = TEST_USER_ID): AuthResult {
  const result = new AuthResult();
  result.userId = userId;
  result.requiresEncryptionKeyMigration = false;
  result.requiresDeviceVerification = false;
  // twoFactorProviders defaults to null (no 2FA required)
  // ssoOrganizationIdentifier defaults to undefined (no SSO required)
  return result;
}

/** Build a 2FA-required AuthResult: twoFactorProviders must be non-null */
function mock2faAuthResult(): AuthResult {
  const result = mockSuccessAuthResult();
  result.twoFactorProviders = { [TwoFactorProviderType.Authenticator]: {} };
  return result;
}

function makeProvider(type: TwoFactorProviderType, name: string): TwoFactorProviderDetails {
  return { type, name } as TwoFactorProviderDetails;
}

// --- Test Suite ---

describe("LoginCommand", () => {
  let command: LoginCommand;

  let loginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let authService: MockProxy<AuthService>;
  let twoFactorApiService: MockProxy<TwoFactorApiService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let accountService: MockProxy<AccountService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let syncService: MockProxy<SyncService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let logoutCallback: jest.Mock;
  let ssoUrlService: MockProxy<SsoUrlService>;
  let i18nService: MockProxy<I18nService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let encryptedMigrator: MockProxy<EncryptedMigrator>;

  // Env var snapshot for save/restore
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = ["BW_NOINTERACTION", "BW_SESSION", "BW_CLIENTID", "BW_CLIENTSECRET", "MY_PW"];

  beforeEach(() => {
    // Save env vars
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    // Non-interactive by default to avoid inquirer prompts
    process.env.BW_NOINTERACTION = "true";
    delete process.env.BW_SESSION;
    delete process.env.BW_CLIENTID;
    delete process.env.BW_CLIENTSECRET;
    delete process.env.MY_PW;

    // Create mocks
    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    authService = mock<AuthService>();
    twoFactorApiService = mock<TwoFactorApiService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    accountService = mock<AccountService>();
    twoFactorService = mock<TwoFactorService>();
    syncService = mock<SyncService>();
    keyConnectorService = mock<KeyConnectorService>();
    logoutCallback = jest.fn().mockResolvedValue(undefined);
    ssoUrlService = mock<SsoUrlService>();
    i18nService = mock<I18nService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    encryptedMigrator = mock<EncryptedMigrator>();

    // Default mock behaviors for a successful password login
    i18nService.t.mockImplementation((key: string) => key);
    cryptoFunctionService.randomBytes.mockResolvedValue(MOCK_SESSION_KEY);
    loginStrategyService.logIn.mockResolvedValue(mockSuccessAuthResult());
    keyConnectorService.requiresDomainConfirmation$.mockReturnValue(of(null));
    masterPasswordService.forceSetPasswordReason$.mockReturnValue(of(ForceSetPasswordReason.None));
    syncService.fullSync.mockResolvedValue(true);
    keyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    encryptedMigrator.runMigrations.mockResolvedValue(undefined);
    accountService.activeAccount$ = of({ id: TEST_USER_ID } as any);
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://vault.bitwarden.com",
    } as any);

    command = new LoginCommand(
      loginStrategyService,
      authService,
      twoFactorApiService,
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      accountService,
      twoFactorService,
      syncService,
      keyConnectorService,
      logoutCallback,
      ssoUrlService,
      i18nService,
      masterPasswordService,
      userDecryptionOptionsService,
      encryptedMigrator,
    );
  });

  afterEach(() => {
    // Restore env vars
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Input Validation
  // =========================================================================

  describe("input validation", () => {
    describe("API key flow", () => {
      const apiKeyOptions = { apikey: true };

      it("returns badRequest when client_id is null", async () => {
        delete process.env.BW_CLIENTID;
        process.env.BW_CLIENTSECRET = "secret";

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("client_id is required.");
      });

      it("returns badRequest when client_id is empty", async () => {
        process.env.BW_CLIENTID = "";
        process.env.BW_CLIENTSECRET = "secret";

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("client_id is required.");
      });

      it("returns badRequest when client_id is whitespace", async () => {
        process.env.BW_CLIENTID = "  ";
        process.env.BW_CLIENTSECRET = "secret";

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("client_id is required.");
      });

      it("returns badRequest when client_secret is null", async () => {
        process.env.BW_CLIENTID = "user.xxx";
        delete process.env.BW_CLIENTSECRET;

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("client_secret is required.");
      });

      it("returns badRequest when client_secret is empty", async () => {
        process.env.BW_CLIENTID = "user.xxx";
        process.env.BW_CLIENTSECRET = "";

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("client_secret is required.");
      });

      it("returns error when client_id does not start with 'user'", async () => {
        process.env.BW_CLIENTID = "organization.xxx";
        process.env.BW_CLIENTSECRET = "secret";

        const response = await command.run(NULL, NULL, apiKeyOptions);

        expect(response.success).toBe(false);
        expect(response.message).toContain("Organization API Key");
      });
    });

    describe("password flow", () => {
      it("returns badRequest when email is null (non-interactive)", async () => {
        const response = await command.run(NULL, "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Email address is required.");
      });

      it("returns badRequest when email is empty (non-interactive)", async () => {
        const response = await command.run("", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Email address is required.");
      });

      it("returns badRequest when email is whitespace (non-interactive)", async () => {
        const response = await command.run("  ", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Email address is required.");
      });

      it("returns badRequest when email has no @", async () => {
        const response = await command.run("bademail", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Email address is invalid.");
      });

      it("returns badRequest when password is null (non-interactive)", async () => {
        const response = await command.run("a@b.c", NULL, {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Master password is required.");
      });

      it("returns badRequest when password is empty (non-interactive)", async () => {
        const response = await command.run("a@b.c", "", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Master password is required.");
      });

      it("reads password from passwordenv option", async () => {
        process.env.MY_PW = "envpass";

        const response = await command.run("a@b.c", NULL, { passwordenv: "MY_PW" });

        expect(response.success).toBe(true);
        const creds = loginStrategyService.logIn.mock.calls[0][0] as PasswordLoginCredentials;
        expect(creds.email).toBe("a@b.c");
        expect(creds.masterPassword).toBe("envpass");
      });

      it("reads password from passwordfile option", async () => {
        const response = await command.run("a@b.c", NULL, { passwordfile: "/tmp/pw.txt" });

        expect(response.success).toBe(true);
        expect(NodeUtils.readFirstLine).toHaveBeenCalledWith("/tmp/pw.txt");
        const creds = loginStrategyService.logIn.mock.calls[0][0] as PasswordLoginCredentials;
        expect(creds.masterPassword).toBe("filepass");
      });

      it("passes null twoFactor when no code provided", async () => {
        await command.run("a@b.c", "password", {});

        expect(loginStrategyService.logIn).toHaveBeenCalledWith(
          expect.any(PasswordLoginCredentials),
        );
        // PasswordLoginCredentials constructor receives twoFactor as 3rd arg.
        // When no options.code, twoFactor is null.
        const creds = loginStrategyService.logIn.mock.calls[0][0] as PasswordLoginCredentials;
        expect(creds.twoFactor).toBeNull();
      });
    });
  });

  // =========================================================================
  // 2. Login Strategy Dispatch
  // =========================================================================

  describe("login strategy dispatch", () => {
    it("calls logIn with UserApiLoginCredentials for API key login", async () => {
      process.env.BW_CLIENTID = "user.xxx";
      process.env.BW_CLIENTSECRET = "secret";

      await command.run(NULL, NULL, { apikey: true });

      expect(loginStrategyService.logIn).toHaveBeenCalledWith(expect.any(UserApiLoginCredentials));
    });

    it("returns friendly error on invalid_client API response", async () => {
      process.env.BW_CLIENTID = "user.xxx";
      process.env.BW_CLIENTSECRET = "secret";
      loginStrategyService.logIn.mockRejectedValue({
        response: { error: "invalid_client" },
      });

      const response = await command.run(NULL, NULL, { apikey: true });

      expect(response.success).toBe(false);
      expect(response.message).toBe("client_id or client_secret is incorrect. Try again.");
    });

    it("rethrows non-invalid_client API errors to outer catch", async () => {
      process.env.BW_CLIENTID = "user.xxx";
      process.env.BW_CLIENTSECRET = "secret";
      const error = new ErrorResponse({ Message: "Server error" } as any, 500);
      loginStrategyService.logIn.mockRejectedValue(error);

      const response = await command.run(NULL, NULL, { apikey: true });

      expect(response.success).toBe(false);
      expect(response.message).toBe("Server error");
    });
  });

  // =========================================================================
  // 3. Post-Auth Response Handling
  // =========================================================================

  describe("post-auth response handling", () => {
    describe("requiresEncryptionKeyMigration", () => {
      it("returns error when encryption key migration required", async () => {
        const authResult = mockSuccessAuthResult();
        authResult.requiresEncryptionKeyMigration = true;
        loginStrategyService.logIn.mockResolvedValue(authResult);

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("legacyEncryptionUnsupported");
      });
    });

    describe("requiresTwoFactor", () => {
      it("returns badRequest when no 2FA providers available", async () => {
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([]);

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("No providers available for this client.");
      });

      it("auto-selects single 2FA provider and calls logInTwoFactor", async () => {
        const provider = makeProvider(TwoFactorProviderType.Authenticator, "Authenticator");
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([provider]);
        loginStrategyService.logInTwoFactor.mockResolvedValue(mockSuccessAuthResult());

        const response = await command.run("a@b.c", "password", { code: "123456" });

        expect(response.success).toBe(true);
        expect(loginStrategyService.logInTwoFactor).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: TwoFactorProviderType.Authenticator,
            token: "123456",
          }),
        );
      });

      it("returns error when method filter yields no match (non-interactive)", async () => {
        // Need 2+ providers so auto-select (length === 1) doesn't trigger
        const providers = [
          makeProvider(TwoFactorProviderType.Authenticator, "Authenticator"),
          makeProvider(TwoFactorProviderType.Email, "Email"),
        ];
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue(providers);

        // Yubikey (3) is valid but not offered by the server; non-interactive so no prompt fallback
        const response = await command.run("a@b.c", "password", { method: "3", code: "123456" });

        expect(response.success).toBe(false);
        expect(response.message).toBe("Login failed. No provider selected.");
      });

      it("sends email 2FA verification when provider is Email and no code provided", async () => {
        const provider = makeProvider(TwoFactorProviderType.Email, "Email");
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([provider]);
        loginStrategyService.getEmail.mockResolvedValue("a@b.c");
        loginStrategyService.getMasterPasswordHash.mockResolvedValue("hash");

        await command.run("a@b.c", "password", {});

        expect(twoFactorApiService.postTwoFactorEmail).toHaveBeenCalled();
      });

      it("returns badRequest when 2FA code required but empty (non-interactive)", async () => {
        const provider = makeProvider(TwoFactorProviderType.Authenticator, "Authenticator");
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([provider]);

        // No code, non-interactive
        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Code is required.");
      });

      it("calls logInTwoFactor with provider type and token", async () => {
        const provider = makeProvider(TwoFactorProviderType.Authenticator, "Authenticator");
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([provider]);
        loginStrategyService.logInTwoFactor.mockResolvedValue(mockSuccessAuthResult());

        const response = await command.run("a@b.c", "password", {
          code: "123456",
          method: "0",
        });

        expect(response.success).toBe(true);
        expect(loginStrategyService.logInTwoFactor).toHaveBeenCalledWith(
          expect.any(TokenTwoFactorRequest),
        );
        const tfReq = loginStrategyService.logInTwoFactor.mock.calls[0][0] as TokenTwoFactorRequest;
        expect(tfReq.provider).toBe(TwoFactorProviderType.Authenticator);
        expect(tfReq.token).toBe("123456");
      });
    });

    describe("requiresDeviceVerification", () => {
      it("returns badRequest when device OTP empty (non-interactive)", async () => {
        const authResult = mockSuccessAuthResult();
        authResult.requiresDeviceVerification = true;
        loginStrategyService.logIn.mockResolvedValue(authResult);

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Code is required.");
      });
    });

    describe("second 2FA check", () => {
      it("returns error when 2FA still required after logInTwoFactor", async () => {
        const provider = makeProvider(TwoFactorProviderType.Authenticator, "Authenticator");
        loginStrategyService.logIn.mockResolvedValue(mock2faAuthResult());
        twoFactorService.getSupportedProviders.mockResolvedValue([provider]);
        // logInTwoFactor returns another 2FA-required result
        loginStrategyService.logInTwoFactor.mockResolvedValue(mock2faAuthResult());

        const response = await command.run("a@b.c", "password", { code: "123456" });

        expect(response.success).toBe(false);
        expect(response.message).toBe("Login failed.");
      });
    });
  });

  // =========================================================================
  // 4. Post-Login Flows
  // =========================================================================

  describe("post-login flows", () => {
    describe("SSO MP validation", () => {
      it("skips SSO MP validation for password login", async () => {
        // Password login path: ssoCode and ssoCodeVerifier are null, so validation is skipped
        await command.run("a@b.c", "password", {});

        expect(userDecryptionOptionsService.userDecryptionOptionsById$).not.toHaveBeenCalled();
      });
    });

    describe("key connector domain confirmation", () => {
      it("skips domain confirmation when null", async () => {
        keyConnectorService.requiresDomainConfirmation$.mockReturnValue(of(null));

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(true);
      });

      it("succeeds when domain confirmation command succeeds", async () => {
        keyConnectorService.requiresDomainConfirmation$.mockReturnValue(
          of({
            keyConnectorUrl: "https://kc.example.com",
            organizationSsoIdentifier: "org-sso-id",
          } as KeyConnectorDomainConfirmation),
        );
        const confirmSpy = jest
          .spyOn(ConfirmKeyConnectorDomainCommand.prototype, "run")
          .mockResolvedValue(Response.success());

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(true);
        expect(confirmSpy).toHaveBeenCalled();
      });

      it("returns error when domain confirmation command fails", async () => {
        keyConnectorService.requiresDomainConfirmation$.mockReturnValue(
          of({
            keyConnectorUrl: "https://kc.example.com",
            organizationSsoIdentifier: "org-sso-id",
          } as KeyConnectorDomainConfirmation),
        );
        const confirmSpy = jest
          .spyOn(ConfirmKeyConnectorDomainCommand.prototype, "run")
          .mockResolvedValue(Response.error("denied"));

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("denied");
        expect(confirmSpy).toHaveBeenCalled();
      });
    });

    describe("sync and force password", () => {
      it("calls fullSync after successful login", async () => {
        await command.run("a@b.c", "password", {});

        expect(syncService.fullSync).toHaveBeenCalledWith(true, { skipTokenRefresh: true });
      });

      it("logs out and errors on AdminForcePasswordReset", async () => {
        masterPasswordService.forceSetPasswordReason$.mockReturnValue(
          of(ForceSetPasswordReason.AdminForcePasswordReset),
        );

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toContain("organization administrator");
        expect(logoutCallback).toHaveBeenCalled();
      });

      it("logs out and errors on WeakMasterPassword", async () => {
        masterPasswordService.forceSetPasswordReason$.mockReturnValue(
          of(ForceSetPasswordReason.WeakMasterPassword),
        );

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(false);
        expect(response.message).toContain("organization policies");
        expect(logoutCallback).toHaveBeenCalled();
      });

      it("skips force password check for API key login", async () => {
        process.env.BW_CLIENTID = "user.xxx";
        process.env.BW_CLIENTSECRET = "secret";

        await command.run(NULL, NULL, { apikey: true });

        // forceSetPasswordReason$ should NOT be subscribed for API key flow
        expect(masterPasswordService.forceSetPasswordReason$).not.toHaveBeenCalled();
      });

      it("calls encryptedMigrator.runMigrations", async () => {
        await command.run("a@b.c", "password", {});

        expect(encryptedMigrator.runMigrations).toHaveBeenCalledWith(TEST_USER_ID, "password");
      });

      it("continues to success when no force password reason", async () => {
        masterPasswordService.forceSetPasswordReason$.mockReturnValue(
          of(ForceSetPasswordReason.None),
        );

        const response = await command.run("a@b.c", "password", {});

        expect(response.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // 5. Success Response
  // =========================================================================

  describe("success response", () => {
    it("returns unlock message for API key login (interactive, no KC)", async () => {
      process.env.BW_CLIENTID = "user.xxx";
      process.env.BW_CLIENTSECRET = "secret";
      // Must be interactive for the SSO/apikey unlock message branch
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getUsesKeyConnector.mockResolvedValue(false);

      const response = await command.run(NULL, NULL, { apikey: true });

      expect(response.success).toBe(true);
      expect((response.data as any).title).toBe("You are logged in!");
      expect((response.data as any).message).toContain("unlock");
    });

    it("returns session key message for password login", async () => {
      const response = await command.run("a@b.c", "password", {});

      expect(response.success).toBe(true);
      expect((response.data as any).title).toBe("You are logged in!");
      expect((response.data as any).message).toContain("BW_SESSION");
      expect((response.data as any).raw).toBe(B64_SESSION_KEY);
    });

    it("returns session key message when uses key connector", async () => {
      process.env.BW_CLIENTID = "user.xxx";
      process.env.BW_CLIENTSECRET = "secret";
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

      const response = await command.run(NULL, NULL, { apikey: true });

      expect(response.success).toBe(true);
      // When usesKeyConnector is true, falls through to session key message
      expect((response.data as any).message).toContain("BW_SESSION");
      expect((response.data as any).raw).toBe(B64_SESSION_KEY);
    });

    it("sets BW_SESSION env var via validatedParams", async () => {
      await command.run("a@b.c", "password", {});

      expect(process.env.BW_SESSION).toBe(B64_SESSION_KEY);
    });
  });

  // =========================================================================
  // 6. Error Handling
  // =========================================================================

  describe("error handling", () => {
    it("returns localized error for 'Username or password is incorrect'", async () => {
      const errorResponse = new ErrorResponse(
        { Message: "Username or password is incorrect. Try again." },
        400,
      );
      loginStrategyService.logIn.mockRejectedValue(errorResponse);

      const response = await command.run("a@b.c", "password", {});

      expect(response.success).toBe(false);
      expect(i18nService.t).toHaveBeenCalledWith(
        "invalidMasterPasswordConfirmEmailAndHost",
        expect.any(String),
      );
    });

    it("passes through generic errors", async () => {
      loginStrategyService.logIn.mockRejectedValue(new Error("boom"));

      const response = await command.run("a@b.c", "password", {});

      expect(response.success).toBe(false);
      expect(response.message).toContain("boom");
    });
  });
});
