import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { PromptMigrationPasswordComponent } from "@bitwarden/key-management-ui";
import { LogService } from "@bitwarden/logging";

import {
  EncryptedMigrationsSchedulerService,
  ENCRYPTED_MIGRATION_DISMISSED,
} from "./encrypted-migrations-scheduler.service";

describe("EncryptedMigrationsSchedulerService", () => {
  let service: EncryptedMigrationsSchedulerService;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockEncryptedMigrator: jest.Mocked<EncryptedMigrator>;
  let mockStateProvider: jest.Mocked<StateProvider>;
  let mockSyncService: jest.Mocked<SyncService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockLogService: jest.Mocked<LogService>;

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
    const mockUserState = createMockUserState(null);

    mockAccountService = {
      accounts$: of({} as Record<UserId, AccountInfo>),
    } as any;

    mockAuthService = {
      authStatusFor$: jest.fn().mockReturnValue(of(AuthenticationStatus.Unlocked)),
    } as any;

    mockEncryptedMigrator = {
      needsMigrations: jest.fn().mockResolvedValue("noMigrationNeeded"),
      runMigrations: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockStateProvider = {
      getUser: jest.fn().mockReturnValue(mockUserState),
      setUserState: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSyncService = {
      lastSync$: jest.fn().mockReturnValue(of(new Date())),
    } as any;

    const mockDialogRef = {
      closed: of(mockMasterPassword),
    };

    mockDialogService = {
      open: jest.fn().mockReturnValue(mockDialogRef),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn().mockImplementation((key: string) => `translated_${key}`),
    } as any;

    mockLogService = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    // Mock the static open method
    jest.spyOn(PromptMigrationPasswordComponent, "open").mockReturnValue(mockDialogRef as any);

    TestBed.configureTestingModule({
      providers: [
        EncryptedMigrationsSchedulerService,
        { provide: AccountService, useValue: mockAccountService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EncryptedMigrator, useValue: mockEncryptedMigrator },
        { provide: StateProvider, useValue: mockStateProvider },
        { provide: SyncService, useValue: mockSyncService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    service = TestBed.inject(EncryptedMigrationsSchedulerService);
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
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("noMigrationNeeded");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[EncryptedMigrationsScheduler] No migrations needed for user ${mockUserId}`,
      );
      expect(mockEncryptedMigrator.runMigrations).not.toHaveBeenCalled();
    });

    it("should run migrations without interaction when master password is not required", async () => {
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigrationWithMasterPassword");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.needsMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[EncryptedMigrationsScheduler] User ${mockUserId} needs migrations with master password`,
      );
      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId);
    });

    it("should run migrations with interaction when migration is needed", async () => {
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigration");

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
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigrationWithMasterPassword");

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should handle errors during migration without interaction", async () => {
      const mockError = new Error("Migration failed");
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigrationWithMasterPassword");
      mockEncryptedMigrator.runMigrations.mockRejectedValue(mockError);

      await service.runMigrationsIfNeeded(mockUserId);

      expect(mockEncryptedMigrator.runMigrations).toHaveBeenCalledWith(mockUserId);
      expect(mockLogService.error).toHaveBeenCalledWith(
        "[EncryptedMigrationsInitiator] Error during migration without interaction",
        mockError,
      );
    });
  });

  describe("runMigrationsWithInteraction", () => {
    beforeEach(() => {
      mockEncryptedMigrator.needsMigrations.mockResolvedValue("needsMigration");
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
        "[EncryptedMigrationsInitiator] Migration prompt dismissed recently, skipping for now.",
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
        "[EncryptedMigrationsInitiator] Error during migration prompt",
        mockError,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "translated_migrationsFailed",
      });
    });
  });
});
