import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import {
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

import { LoginCapability } from "./login";

describe("LoginCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let loginStrategyService: ReturnType<typeof mock<LoginStrategyServiceAbstraction>>;
  let loginSuccessHandlerService: ReturnType<typeof mock<LoginSuccessHandlerService>>;
  let router: ReturnType<typeof mock<Router>>;
  let platformUtilsService: ReturnType<typeof mock<PlatformUtilsService>>;
  let sut: LoginCapability;

  function authResult(fields: Partial<AuthResult>): AuthResult {
    return Object.assign(new AuthResult(), fields);
  }

  beforeEach(() => {
    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    loginSuccessHandlerService = mock<LoginSuccessHandlerService>();
    router = mock<Router>();
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(ClientType.Web);
    sut = new LoginCapability(
      loginStrategyService,
      loginSuccessHandlerService,
      router,
      platformUtilsService,
    );
  });

  it("logs in with a master password, runs the success handler and opens the vault", async () => {
    loginStrategyService.logIn.mockResolvedValue(authResult({ userId, masterPassword: "pw" }));

    await expect(sut.logInWithMasterPassword("user@example.com", "pw")).resolves.toEqual({
      status: "LoggedIn",
      userId,
    });

    expect(loginStrategyService.logIn).toHaveBeenCalledWith(
      new PasswordLoginCredentials("user@example.com", "pw"),
    );
    expect(loginSuccessHandlerService.run).toHaveBeenCalledWith(userId, "pw");
    expect(router.navigate).toHaveBeenCalledWith(["vault"]);
  });

  it("opens the extension's vault tab in the browser extension", async () => {
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    loginStrategyService.logIn.mockResolvedValue(authResult({ userId, masterPassword: "pw" }));

    await sut.logInWithMasterPassword("user@example.com", "pw");

    expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
  });

  it("opens two-step login when a second factor is required", async () => {
    loginStrategyService.logIn.mockResolvedValue(authResult({ twoFactorProviders: {} }));

    await expect(sut.logInWithMasterPassword("user@example.com", "pw")).resolves.toEqual({
      status: "TwoFactorRequired",
    });

    expect(router.navigate).toHaveBeenCalledWith(["2fa"]);
    expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
  });

  it("opens device verification for a new device", async () => {
    loginStrategyService.logIn.mockResolvedValue(authResult({ requiresDeviceVerification: true }));

    await expect(sut.logInWithMasterPassword("user@example.com", "pw")).resolves.toEqual({
      status: "DeviceVerificationRequired",
    });

    expect(router.navigate).toHaveBeenCalledWith(["device-verification"]);
    expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
  });

  it("reports SSO without navigating", async () => {
    loginStrategyService.logIn.mockResolvedValue(
      authResult({ ssoOrganizationIdentifier: "org-identifier" }),
    );

    await expect(sut.logInWithMasterPassword("user@example.com", "pw")).resolves.toEqual({
      status: "SsoRequired",
    });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
  });

  it("reports legacy encryption without navigating", async () => {
    loginStrategyService.logIn.mockResolvedValue(
      authResult({ requiresEncryptionKeyMigration: true }),
    );

    await expect(sut.logInWithMasterPassword("user@example.com", "pw")).resolves.toEqual({
      status: "LegacyEncryptionUnsupported",
    });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(loginSuccessHandlerService.run).not.toHaveBeenCalled();
  });

  it("rejects when the credentials are wrong", async () => {
    loginStrategyService.logIn.mockRejectedValue(new Error("Username or password is incorrect."));

    await expect(sut.logInWithMasterPassword("user@example.com", "wrong")).rejects.toThrow(
      "Username or password is incorrect.",
    );

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
