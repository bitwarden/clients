import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService } from "@bitwarden/state";

import { LogoutService } from "../../abstractions";

import { DefaultLockService } from "./lock.service";

describe("DefaultLockService", () => {
  const mockUser1 = "user1" as UserId;
  const mockUser2 = "user2" as UserId;
  const mockUser3 = "user3" as UserId;

  const accountService = mockAccountServiceWith(mockUser1);
  const biometricsService = mock<BiometricsService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const logoutService = mock<LogoutService>();
  const messagingService = mock<MessagingService>();
  const searchService = mock<SearchService>();
  const folderService = mock<FolderService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateEventRunnerService = mock<StateEventRunnerService>();
  const cipherService = mock<CipherService>();
  const authService = mock<AuthService>();
  const systemService = mock<SystemService>();
  const processReloadService = mock<ProcessReloadServiceAbstraction>();
  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const sut = new DefaultLockService(
    accountService,
    biometricsService,
    vaultTimeoutSettingsService,
    logoutService,
    messagingService,
    searchService,
    folderService,
    masterPasswordService,
    stateEventRunnerService,
    cipherService,
    authService,
    systemService,
    processReloadService,
    logService,
    keyService,
  );

  describe("lockAll", () => {
    const sut = new DefaultLockService(
      accountService,
      biometricsService,
      vaultTimeoutSettingsService,
      logoutService,
      messagingService,
      searchService,
      folderService,
      masterPasswordService,
      stateEventRunnerService,
      cipherService,
      authService,
      systemService,
      processReloadService,
      logService,
      keyService,
    );

    it("locks the active account last", async () => {
      await accountService.addAccount(mockUser2, {
        name: "name2",
        email: "email2@example.com",
        emailVerified: false,
      });

      await accountService.addAccount(mockUser3, {
        name: "name3",
        email: "name3@example.com",
        emailVerified: false,
      });

      const lockSpy = jest.spyOn(sut, "lock").mockResolvedValue(undefined);

      await sut.lockAll();

      // Non-Active users should be called first
      expect(lockSpy).toHaveBeenNthCalledWith(1, mockUser2);
      expect(lockSpy).toHaveBeenNthCalledWith(2, mockUser3);

      // Active user should be called last
      expect(lockSpy).toHaveBeenNthCalledWith(3, mockUser1);
    });
  });

  describe("lock", () => {
    const userId = mockUser1;

    it("returns early if user is already logged out", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));
      await sut.lock(userId);
      // Should return early, not call logoutService.logout
      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(stateEventRunnerService.handleEvent).not.toHaveBeenCalled();
    });

    it("logs out if user cannot lock", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      vaultTimeoutSettingsService.canLock.mockResolvedValue(false);
      await sut.lock(userId);
      expect(logoutService.logout).toHaveBeenCalledWith(userId, "vaultTimeout");
      expect(stateEventRunnerService.handleEvent).not.toHaveBeenCalled();
    });

    it("locks user", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));
      logoutService.logout.mockClear();
      vaultTimeoutSettingsService.canLock.mockResolvedValue(true);
      await sut.lock(userId);
      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("lock", userId);
    });
  });
});
