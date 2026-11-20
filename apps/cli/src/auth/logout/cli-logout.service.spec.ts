import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService, StateService } from "@bitwarden/state";

import { CliLogoutService } from "./cli-logout.service";

describe("CliLogoutService", () => {
  const userId = "user-id" as UserId;

  let authService: MockProxy<AuthService>;
  let accountService: MockProxy<AccountService>;
  let eventUploadService: MockProxy<EventUploadService>;
  let keyService: MockProxy<KeyService>;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<InternalFolderService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockProxy<SdkService>;

  let sut: CliLogoutService;

  beforeEach(() => {
    authService = mock<AuthService>();
    accountService = mock<AccountService>();
    eventUploadService = mock<EventUploadService>();
    keyService = mock<KeyService>();
    cipherService = mock<CipherService>();
    folderService = mock<InternalFolderService>();
    stateEventRunnerService = mock<StateEventRunnerService>();
    stateService = mock<StateService>();
    tokenService = mock<TokenService>();
    logService = mock<LogService>();
    sdkService = mock<SdkService>();

    sut = new CliLogoutService(
      authService,
      accountService,
      eventUploadService,
      keyService,
      cipherService,
      folderService,
      stateEventRunnerService,
      stateService,
      tokenService,
      logService,
      sdkService,
    );
  });

  describe("logout", () => {
    it("logs the user id and reason", async () => {
      await sut.logout(userId, "userInitiated");

      expect(logService.info).toHaveBeenCalledWith(
        "Logging out user %s for reason: %s",
        userId,
        "userInitiated",
      );
    });

    it("disposes the SDK client before it clears the user's keys and state", async () => {
      await sut.logout(userId, "userInitiated");

      expect(sdkService.logout).toHaveBeenCalledWith(userId);
      const sdkLogoutOrder = sdkService.logout.mock.invocationCallOrder[0];
      expect(sdkLogoutOrder).toBeLessThan(keyService.clearKeys.mock.invocationCallOrder[0]);
      expect(sdkLogoutOrder).toBeLessThan(
        stateEventRunnerService.handleEvent.mock.invocationCallOrder[0],
      );
    });

    it("uploads events and clears keys, ciphers, and folders for the given user", async () => {
      await sut.logout(userId, "userInitiated");

      expect(authService.logOut).toHaveBeenCalled();
      expect(eventUploadService.uploadEvents).toHaveBeenCalledWith(userId);
      expect(keyService.clearKeys).toHaveBeenCalledWith(userId);
      expect(cipherService.clear).toHaveBeenCalledWith(userId);
      expect(folderService.clear).toHaveBeenCalledWith(userId);
    });

    it("uploads events before it clears the tokens that the upload needs", async () => {
      await sut.logout(userId, "userInitiated");

      expect(eventUploadService.uploadEvents.mock.invocationCallOrder[0]).toBeLessThan(
        tokenService.clearTokens.mock.invocationCallOrder[0],
      );
    });

    it("clears state, tokens, and the account for the given user", async () => {
      await sut.logout(userId, "userInitiated");

      expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("logout", userId);
      expect(stateService.clean).toHaveBeenCalledWith({ userId });
      expect(tokenService.clearTokens).toHaveBeenCalledWith(userId);
      expect(accountService.clean).toHaveBeenCalledWith(userId);
      expect(accountService.switchAccount).toHaveBeenCalledWith(null);
    });

    it("removes the BW_SESSION environment variable", async () => {
      process.env.BW_SESSION = "session-key";

      await sut.logout(userId, "userInitiated");

      expect("BW_SESSION" in process.env).toBe(false);
    });

    it("returns undefined because the CLI has no next active user", async () => {
      const result = await sut.logout(userId, "userInitiated");

      expect(result).toBeUndefined();
    });
  });
});
