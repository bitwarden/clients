import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { WebLogoutService } from "./web-logout.service";

describe("WebLogoutService", () => {
  const userId = "user-id" as UserId;

  let logService: MockProxy<LogService>;
  let eventUploadService: MockProxy<EventUploadService>;
  let authService: MockProxy<AuthService>;
  let keyService: MockProxy<KeyService>;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<InternalFolderService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;
  let accountService: MockProxy<AccountService>;
  let router: MockProxy<Router>;
  let processReloadService: MockProxy<ProcessReloadServiceAbstraction>;
  let sdkService: MockProxy<SdkService>;

  let sut: WebLogoutService;

  beforeEach(() => {
    logService = mock<LogService>();
    eventUploadService = mock<EventUploadService>();
    authService = mock<AuthService>();
    keyService = mock<KeyService>();
    cipherService = mock<CipherService>();
    folderService = mock<InternalFolderService>();
    biometricStateService = mock<BiometricStateService>();
    stateEventRunnerService = mock<StateEventRunnerService>();
    stateService = mock<StateService>();
    tokenService = mock<TokenService>();
    accountService = mock<AccountService>();
    router = mock<Router>();
    processReloadService = mock<ProcessReloadServiceAbstraction>();
    sdkService = mock<SdkService>();

    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));

    sut = new WebLogoutService(
      logService,
      eventUploadService,
      authService,
      keyService,
      cipherService,
      folderService,
      biometricStateService,
      stateEventRunnerService,
      stateService,
      tokenService,
      accountService,
      router,
      processReloadService,
      sdkService,
    );
  });

  async function runLogOutCallback() {
    const callback = authService.logOut.mock.calls[0][0] as () => Promise<void>;
    await callback();
  }

  it("logs the user id and reason", async () => {
    await sut.logout(userId, "userInitiated");

    expect(logService.info).toHaveBeenCalledWith(
      "Logging out user %s for reason: %s",
      userId,
      "userInitiated",
    );
  });

  it("disposes the SDK client before it uploads events or clears the user's data", async () => {
    await sut.logout(userId, "userInitiated");

    expect(sdkService.logout).toHaveBeenCalledWith(userId);
    const disposeOrder = sdkService.logout.mock.invocationCallOrder[0];
    expect(disposeOrder).toBeLessThan(eventUploadService.uploadEvents.mock.invocationCallOrder[0]);
    expect(disposeOrder).toBeLessThan(keyService.clearKeys.mock.invocationCallOrder[0]);
  });

  it("sets loggingOut to true", async () => {
    expect(sut.loggingOut()).toBe(false);

    await sut.logout(userId, "userInitiated");

    expect(sut.loggingOut()).toBe(true);
  });

  it("uploads events and clears the user's data before it logs out", async () => {
    await sut.logout(userId, "userInitiated");

    expect(eventUploadService.uploadEvents).toHaveBeenCalledWith(userId);
    expect(keyService.clearKeys).toHaveBeenCalledWith(userId);
    expect(cipherService.clear).toHaveBeenCalledWith(userId);
    expect(folderService.clear).toHaveBeenCalledWith(userId);
    expect(biometricStateService.logout).toHaveBeenCalledWith(userId);
    expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("logout", userId);
    expect(authService.logOut).toHaveBeenCalledWith(expect.any(Function), userId);
  });

  it("returns undefined, because web never switches to another account", async () => {
    const result = await sut.logout(userId, "userInitiated");

    expect(result).toBeUndefined();
  });

  it("does not reload the page before the auth service runs its logout callback", async () => {
    await sut.logout(userId, "userInitiated");

    expect(processReloadService.reloadProcess).not.toHaveBeenCalled();
  });

  describe("auth service logout callback", () => {
    it("cleans the account state and tokens, then navigates to the root route and reloads the page", async () => {
      await sut.logout(userId, "userInitiated");

      await runLogOutCallback();

      expect(stateService.clean).toHaveBeenCalledWith({ userId });
      expect(tokenService.clearTokens).toHaveBeenCalledWith(userId);
      expect(accountService.clean).toHaveBeenCalledWith(userId);
      expect(accountService.switchAccount).toHaveBeenCalledWith(null);
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(processReloadService.reloadProcess).toHaveBeenCalled();
    });
  });
});
