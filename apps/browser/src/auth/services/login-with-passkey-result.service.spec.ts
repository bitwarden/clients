// eslint-disable-next-line no-restricted-imports
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { LoginSuccessHandlerService } from "@bitwarden/auth/common";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PrfKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { LoginWithPasskeyResultService } from "./login-with-passkey-result.service";
import { PasskeyLoginRelayResult, PasskeyRelayService } from "./passkey-relay.service";

describe("LoginWithPasskeyResultService", () => {
  let service: LoginWithPasskeyResultService;
  let passkeyRelayService: PasskeyRelayService;
  let webAuthnLoginService: WebAuthnLoginServiceAbstraction;
  let webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction;
  let loginSuccessHandlerService: LoginSuccessHandlerService;
  let keyService: KeyService;
  let i18nService: I18nService;
  let logService: LogService;

  const testUserId = "00000000-0000-0000-0000-000000000001" as UserId;
  const token = "login-token";
  const assertionData = JSON.stringify({ id: "assertion-id", rawId: "raw-id" });

  const setupDependencies = (overrides?: {
    relayResult?: PasskeyLoginRelayResult | null;
    relayType?: "login" | "unlock";
  }) => {
    const relayResult =
      overrides?.relayResult === undefined
        ? ({
            type: "login",
            token,
            assertionData,
            prfOutput: null,
          } as PasskeyLoginRelayResult)
        : overrides?.relayResult;

    (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(relayResult);
  };

  beforeEach(() => {
    passkeyRelayService = mock<PasskeyRelayService>();
    webAuthnLoginService = mock<WebAuthnLoginServiceAbstraction>();
    webAuthnLoginPrfKeyService = mock<WebAuthnLoginPrfKeyServiceAbstraction>();
    loginSuccessHandlerService = mock<LoginSuccessHandlerService>();
    keyService = mock<KeyService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    i18nService.t = jest.fn((key: string) => key) as any;
    (keyService.userKey$ as jest.Mock).mockReturnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        LoginWithPasskeyResultService,
        { provide: PasskeyRelayService, useValue: passkeyRelayService },
        { provide: WebAuthnLoginServiceAbstraction, useValue: webAuthnLoginService },
        { provide: WebAuthnLoginPrfKeyServiceAbstraction, useValue: webAuthnLoginPrfKeyService },
        { provide: LoginSuccessHandlerService, useValue: loginSuccessHandlerService },
        { provide: KeyService, useValue: keyService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(LoginWithPasskeyResultService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("completeLogin", () => {
    it("returns a timeout error when there is no relay result", async () => {
      setupDependencies({ relayResult: null });

      const result = await service.completeLogin();

      expect(result).toEqual({
        success: false,
        errorMessage: "passkeyLoginTimeout",
      });
      expect(logService.error).toHaveBeenCalledWith("[PasskeyLogin] No relay result available");
      expect(webAuthnLoginService.logIn).not.toHaveBeenCalled();
    });

    it("returns a timeout error when the relay result has the wrong type", async () => {
      setupDependencies({
        relayResult: {
          type: "unlock",
          credentialId: "credential-id",
          prfOutput: new Uint8Array([1]).buffer,
        } as any,
      });

      const result = await service.completeLogin();

      expect(result).toEqual({
        success: false,
        errorMessage: "passkeyLoginTimeout",
      });
    });

    it("returns an invalid passkey error when assertion data is not valid JSON", async () => {
      setupDependencies({
        relayResult: {
          type: "login",
          token,
          assertionData: "not-json",
          prfOutput: null,
        },
      });

      const result = await service.completeLogin();

      expect(result).toEqual({
        success: false,
        errorMessage: "invalidPasskeyPleaseTryAgain",
      });
      expect(webAuthnLoginService.logIn).not.toHaveBeenCalled();
    });

    it("submits the assertion and returns success when no PRF output is present", async () => {
      setupDependencies();
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue({
        userId: testUserId,
        twoFactorProviders: null,
      });

      const result = await service.completeLogin();

      expect(result).toEqual({ success: true, userId: testUserId });
      expect(webAuthnLoginService.logIn).toHaveBeenCalledWith(
        expect.objectContaining({
          token,
          prfKey: null,
        }),
      );
      expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
    });

    it("derives the PRF key, zeroes the PRF output, and submits the assertion", async () => {
      const prfOutput = new Uint8Array([1, 2, 3, 4]).buffer;
      const prfKey = mock<PrfKey>();
      (webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf as jest.Mock).mockResolvedValue(prfKey);
      setupDependencies({
        relayResult: {
          type: "login",
          token,
          assertionData,
          prfOutput,
        },
      });
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue({
        userId: testUserId,
        twoFactorProviders: null,
      });

      const result = await service.completeLogin();

      expect(result).toEqual({ success: true, userId: testUserId });
      expect(webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf).toHaveBeenCalledWith(prfOutput);
      expect(new Uint8Array(prfOutput).every((byte) => byte === 0)).toBe(true);
      expect(webAuthnLoginService.logIn).toHaveBeenCalledWith(
        expect.objectContaining({
          token,
          prfKey,
        }),
      );
    });

    it("runs the login success handler when a user key is present", async () => {
      const userKey = new BehaviorSubject<unknown>({ key: [1, 2, 3] });
      (keyService.userKey$ as jest.Mock).mockReturnValue(userKey.asObservable());
      setupDependencies();
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue({
        userId: testUserId,
        twoFactorProviders: null,
      });

      await service.completeLogin();

      expect(loginSuccessHandlerService.run).toHaveBeenCalledWith(testUserId, null);
    });

    it("does not run the login success handler when no user key is present", async () => {
      setupDependencies();
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue({
        userId: testUserId,
        twoFactorProviders: null,
      });

      await service.completeLogin();

      expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
    });

    it("returns a two-factor error when the server requires two-factor authentication", async () => {
      setupDependencies();
      const authResult = Object.assign(new AuthResult(), {
        userId: testUserId,
        twoFactorProviders: { [TwoFactorProviderType.WebAuthn]: { some: "data" } },
      });
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue(authResult);

      const result = await service.completeLogin();

      expect(result).toEqual({
        success: false,
        errorMessage: "twoFactorForPasskeysNotSupportedOnClientUpdateToLogIn",
      });
      expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
    });

    it("returns an invalid passkey error when the auth result has no userId", async () => {
      setupDependencies();
      (webAuthnLoginService.logIn as jest.Mock).mockResolvedValue({
        userId: null,
        twoFactorProviders: null,
      });

      const result = await service.completeLogin();

      expect(result).toEqual({
        success: false,
        errorMessage: "invalidPasskeyPleaseTryAgain",
      });
    });
  });
});
