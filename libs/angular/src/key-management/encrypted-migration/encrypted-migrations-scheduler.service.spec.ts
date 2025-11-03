import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountInfo } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { FakeAccountService } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import {
  DefaultEncryptedMigrationsSchedulerService,
  ENCRYPTED_MIGRATION_DISMISSED,
} from "./encrypted-migrations-scheduler.service";
import { PromptMigrationPasswordComponent } from "./prompt-migration-password.component";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts: Record<UserId, AccountInfo> = {
  [SomeUser]: {
    name: "some user",
    email: "some.user@example.com",
    emailVerified: true,
  },
  [AnotherUser]: {
    name: "some other user",
    email: "some.other.user@example.com",
    emailVerified: true,
  },
};

describe("DefaultEncryptedMigrationsSchedulerService", () => {
  let service: DefaultEncryptedMigrationsSchedulerService;
  const mockAccountService = new FakeAccountService(accounts);
  const mockAuthService = mock<AuthService>();
  const mockEncryptedMigrator = mock<EncryptedMigrator>();
  const mockStateProvider = mock<StateProvider>();
  const mockSyncService = mock<SyncService>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockRouter = mock<Router>();

  const mockUserId = "test-user-id" as UserId;
  const mockMasterPassword = "test-master-password";

  const createMockUserState = <T>(value: T): jest.Mocked<SingleUserState<T>> =>
    ({
      state$: of(value),
      userId: mockUserId,
      update: jest.fn(),
      combinedState$: of([mockUserId, value]),
    }) as any;

  beforeEach(() => {
    const mockDialogRef = {
      closed: of(mockMasterPassword),
    };

    jest.spyOn(PromptMigrationPasswordComponent, "open").mockReturnValue(mockDialogRef as any);
    mockI18nService.t.mockReturnValue("translated_migrationsFailed");

    service = new DefaultEncryptedMigrationsSchedulerService(
      mockSyncService,
      mockAccountService,
      mockStateProvider,
      mockEncryptedMigrator,
      mockAuthService,
      mockLogService,
      mockDialogService,
      mockToastService,
      mockI18nService,
      mockRouter,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("runMigrationsIfNeeded", () => {
    it("should return early if user is not unlocked", async () => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).not.toHaveBeenCalled();
      expect(mockLogService.info).not.toHaveBeenCalled();
    });

    it("should log and return when no migration is needed", async () => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("noMigrationNeeded");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[EncryptedMigrationsScheduler] No migrations needed for user ${mockUserId}`,
      );
      expect(mockEncryptedMigrator.runMigrations).not.toHaveBeenCalled();
    });

    it("should run migrations without interaction when master password is not required", async () => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigration");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[EncryptedMigrationsScheduler] User ${mockUserId} needs migrations with master password`,
      );
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId, null);
    });

    it("should run migrations with interaction when migration is needed", async () => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigrationWithMasterPassword");
      const mockUserState = createMockUserState(null);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[EncryptedMigrationsScheduler] User ${mockUserId} needs migrations with master password`,
      );
      expect(PromptMigrationPasswordComponent.open).toHaveBeenCalledWith(mockDialogService);
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(
        mockUserId,
        mockMasterPassword,
      );
    });
  });

  describe("runMigrationsWithoutInteraction", () => {
    it("should run migrations without master password", async () => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigration");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId, null);
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should handle errors during migration without interaction", async () => {
      const mockError = new Error("Migration failed");
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigration");
      mockEncryptedMigrator.runMigrations.mockRejectedValue(mockError);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId, null);
      expect(mockLogService.error).toHaveBeenCalledWith(
        "[EncryptedMigrationsScheduler] Error during migration without interaction",
        mockError,
      );
    });
  });

  describe("runMigrationsWithInteraction", () => {
    beforeEach(() => {
      mockAuthService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigrationWithMasterPassword");
    });

    it("should skip if migration was dismissed recently", async () => {
      const recentDismissDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const mockUserState = createMockUserState(recentDismissDate);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockStateProvider.getUser).toHaveBeenCalledWith(
        mockUserId,
        ENCRYPTED_MIGRATION_DISMISSED,
      );
      expect(mockLogService.info).toHaveBeenCalledWith(
        "[EncryptedMigrationsScheduler] Migration prompt dismissed recently, skipping for now.",
      );
      expect(PromptMigrationPasswordComponent.open).not.toHaveBeenCalled();
    });

    it("should prompt for migration if dismissed date is older than 24 hours", async () => {
      const oldDismissDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const mockUserState = createMockUserState(oldDismissDate);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockStateProvider.getUser).toHaveBeenCalledWith(
        mockUserId,
        ENCRYPTED_MIGRATION_DISMISSED,
      );
      expect(PromptMigrationPasswordComponent.open).toHaveBeenCalledWith(mockDialogService);
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(
        mockUserId,
        mockMasterPassword,
      );
    });

    it("should prompt for migration if no dismiss date exists", async () => {
      const mockUserState = createMockUserState(null);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(PromptMigrationPasswordComponent.open).toHaveBeenCalledWith(mockDialogService);
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(
        mockUserId,
        mockMasterPassword,
      );
    });

    it("should set dismiss date when empty password is provided", async () => {
      const mockUserState = createMockUserState(null);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      const mockDialogRef = {
        closed: of(""), // Empty password
      };
      jest.spyOn(PromptMigrationPasswordComponent, "open").mockReturnValue(mockDialogRef as any);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(PromptMigrationPasswordComponent.open).toHaveBeenCalledWith(mockDialogService);
      expect(mockEncryptedMigrator.runMigrations).not.toHaveBeenCalled();
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        ENCRYPTED_MIGRATION_DISMISSED,
        expect.any(Date),
        mockUserId,
      );
    });

    it("should handle errors during migration prompt and show toast", async () => {
      const mockUserState = createMockUserState(null);
      mockStateProvider.getUser.mockReturnValue(mockUserState);

      const mockError = new Error("Migration failed");
      mockEncryptedMigrator.runMigrations.mockRejectedValue(mockError);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(PromptMigrationPasswordComponent.open).toHaveBeenCalledWith(mockDialogService);
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(
        mockUserId,
        mockMasterPassword,
      );
      expect(mockLogService.error).toHaveBeenCalledWith(
        "[EncryptedMigrationsScheduler] Error during migration prompt",
        mockError,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "translated_migrationsFailed",
      });
    });
  });
});
