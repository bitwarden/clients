// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, from, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutService } from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricsService } from "@bitwarden/key-management";
import { StateService } from "@bitwarden/state";

import { FakeAccountService, mockAccountServiceWith } from "../../../../spec";
import { AccountInfo } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { LogService } from "../../../platform/abstractions/log.service";
import { MessagingService } from "../../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { Utils } from "../../../platform/misc/utils";
import { TaskSchedulerService } from "../../../platform/scheduling";
import { StateEventRunnerService } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { FolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "../../../vault/abstractions/search.service";
import { FakeMasterPasswordService } from "../../master-password/services/fake-master-password.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout, VaultTimeoutStringType } from "../types/vault-timeout.type";

import { VaultTimeoutSettingsService } from "./vault-timeout-settings.service";
import { VaultTimeoutService } from "./vault-timeout.service";

describe("VaultTimeoutService", () => {
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<FolderService>;
  let collectionService: MockProxy<CollectionService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let searchService: MockProxy<SearchService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;
  let authService: MockProxy<AuthService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let logService: MockProxy<LogService>;
  let biometricsService: MockProxy<BiometricsService>;
  let logoutService: MockProxy<LogoutService>;
  let lockedCallback: jest.Mock<Promise<void>, [userId: string]>;

  let vaultTimeoutActionSubject: BehaviorSubject<VaultTimeoutAction>;
  let availableVaultTimeoutActionsSubject: BehaviorSubject<VaultTimeoutAction[]>;

  let vaultTimeoutService: VaultTimeoutService;

  const userId = Utils.newGuid() as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();
    cipherService = mock();
    folderService = mock();
    collectionService = mock();
    platformUtilsService = mock();
    messagingService = mock();
    searchService = mock();
    stateService = mock();
    tokenService = mock();
    authService = mock();
    vaultTimeoutSettingsService = mock();
    stateEventRunnerService = mock();
    taskSchedulerService = mock<TaskSchedulerService>();
    logService = mock<LogService>();
    biometricsService = mock<BiometricsService>();
    logoutService = mock<LogoutService>();

    lockedCallback = jest.fn();

    vaultTimeoutActionSubject = new BehaviorSubject(VaultTimeoutAction.Lock);

    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      vaultTimeoutActionSubject,
    );

    availableVaultTimeoutActionsSubject = new BehaviorSubject<VaultTimeoutAction[]>([]);

    vaultTimeoutService = new VaultTimeoutService(
      accountService,
      masterPasswordService,
      cipherService,
      folderService,
      collectionService,
      platformUtilsService,
      messagingService,
      searchService,
      stateService,
      tokenService,
      authService,
      vaultTimeoutSettingsService,
      stateEventRunnerService,
      taskSchedulerService,
      logService,
      biometricsService,
      lockedCallback,
      logoutService,
    );
  });

  // Helper for setting up mocks for multiple users
  const setupAccounts = (
    accounts: Record<
      string,
      {
        authStatus?: AuthenticationStatus;
        isAuthenticated?: boolean;
        lastActive?: number;
        vaultTimeout?: VaultTimeout;
        timeoutAction?: VaultTimeoutAction;
        availableTimeoutActions?: VaultTimeoutAction[];
      }
    >,
    globalSetups?: {
      userId?: string;
      isViewOpen?: boolean;
    },
  ) => {
    // Both are available by default and the specific test can change this per test
    availableVaultTimeoutActionsSubject.next([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]);

    authService.authStatusFor$.mockImplementation((userId) => {
      return from([
        accounts[userId]?.authStatus ?? AuthenticationStatus.LoggedOut,
        AuthenticationStatus.Locked,
      ]);
    });

    authService.getAuthStatus.mockImplementation((userId) => {
      return Promise.resolve(accounts[userId]?.authStatus);
    });
    tokenService.hasAccessToken$.mockImplementation((userId) => {
      return of(accounts[userId]?.isAuthenticated ?? false);
    });

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockImplementation((userId) => {
      return new BehaviorSubject<VaultTimeout>(accounts[userId]?.vaultTimeout);
    });

    // Set desired user active and known users on accounts service : note the only thing that matters here is that the ID are set
    if (globalSetups?.userId) {
      accountService.activeAccountSubject.next({
        id: globalSetups.userId as UserId,
        email: null,
        emailVerified: false,
        name: null,
      });
    }
    accountService.accounts$ = of(
      Object.entries(accounts).reduce(
        (agg, [id]) => {
          agg[id] = {
            email: "",
            emailVerified: true,
            name: "",
          };
          return agg;
        },
        {} as Record<string, AccountInfo>,
      ),
    );
    accountService.accountActivity$ = of(
      Object.entries(accounts).reduce(
        (agg, [id, info]) => {
          agg[id] = info.lastActive ? new Date(info.lastActive) : null;
          return agg;
        },
        {} as Record<string, Date>,
      ),
    );

    platformUtilsService.isPopupOpen.mockResolvedValue(globalSetups?.isViewOpen ?? false);

    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockImplementation((userId) => {
      return new BehaviorSubject<VaultTimeoutAction>(accounts[userId]?.timeoutAction);
    });

    vaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation((userId) => {
      return new BehaviorSubject<VaultTimeoutAction[]>(
        // Default to both options if it wasn't supplied at all
        accounts[userId]?.availableTimeoutActions ?? [
          VaultTimeoutAction.Lock,
          VaultTimeoutAction.LogOut,
        ],
      );
    });
  };

  const expectUserToHaveLocked = (userId: string) => {
    // This does NOT assert all the things that the lock process does
    expect(tokenService.hasAccessToken$).toHaveBeenCalledWith(userId);
    expect(vaultTimeoutSettingsService.availableVaultTimeoutActions$).toHaveBeenCalledWith(userId);
    expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, { userId: userId });
    expect(masterPasswordService.mock.clearMasterKey).toHaveBeenCalledWith(userId);
    expect(cipherService.clearCache).toHaveBeenCalledWith(userId);
    expect(lockedCallback).toHaveBeenCalledWith(userId);
  };

  const expectUserToHaveLoggedOut = (userId: string) => {
    expect(logoutService.logout).toHaveBeenCalledWith(userId, "vaultTimeout");
  };

  const expectNoAction = (userId: string) => {
    expect(lockedCallback).not.toHaveBeenCalledWith(userId);
    expect(logoutService.logout).not.toHaveBeenCalledWith(userId, "vaultTimeout");
  };

  describe("checkVaultTimeout", () => {
    it.each([AuthenticationStatus.Locked, AuthenticationStatus.LoggedOut])(
      "should not try to log out or lock any user that has authStatus === %s.",
      async (authStatus) => {
        platformUtilsService.isPopupOpen.mockResolvedValue(false);
        setupAccounts({
          1: {
            authStatus: authStatus,
            isAuthenticated: true,
          },
        });

        expectNoAction("1");
      },
    );

    it.each([
      VaultTimeoutStringType.Never,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnIdle,
    ])(
      "does not log out or lock a user who has %s as their vault timeout",
      async (vaultTimeout) => {
        setupAccounts({
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            vaultTimeout: vaultTimeout as VaultTimeout,
            isAuthenticated: true,
          },
        });

        await vaultTimeoutService.checkVaultTimeout();

        expectNoAction("1");
      },
    );

    it.each([undefined, null])(
      "should not log out or lock a user who has %s lastActive value",
      async (lastActive) => {
        setupAccounts({
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            vaultTimeout: 1, // One minute
            lastActive: lastActive,
          },
        });

        await vaultTimeoutService.checkVaultTimeout();

        expectNoAction("1");
      },
    );

    it("should lock an account that isn't active and has immediate as their timeout when view is not open", async () => {
      // Arrange
      setupAccounts(
        {
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 0, // Immediately
            lastActive: new Date().getTime() - 10 * 1000, // Last active 10 seconds ago
          },
          2: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 1, // One minute
            lastActive: new Date().getTime() - 10 * 1000, // Last active 10 seconds ago
          },
        },
        {
          isViewOpen: false,
        },
      );

      // Act
      await vaultTimeoutService.checkVaultTimeout();

      // Assert
      expectUserToHaveLocked("1");
      expectNoAction("2");
    });

    it("should run action on an account that hasn't been active for greater than 1 minute and has a vault timeout for 1 minutes", async () => {
      setupAccounts(
        {
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 1, // One minute
            lastActive: new Date().getTime() - 10 * 1000,
          },
          2: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 1, // One minute
            lastActive: new Date().getTime() - 61 * 1000, // Last active 61 seconds ago
          },
          3: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 1, // One minute
            lastActive: new Date().getTime() - 120 * 1000, // Last active 2 minutes ago
            timeoutAction: VaultTimeoutAction.LogOut,
            availableTimeoutActions: [VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut],
          },
          4: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            vaultTimeout: 1, // One minute
            lastActive: new Date().getTime() - 100 * 1000, // Last active 100 seconds ago
            timeoutAction: VaultTimeoutAction.Lock,
            availableTimeoutActions: [VaultTimeoutAction.LogOut],
          },
        },
        { userId: "2", isViewOpen: false }, // Treat user 2 as the active user
      );

      await vaultTimeoutService.checkVaultTimeout();

      expectNoAction("1");
      expectUserToHaveLocked("2");

      // Active users should have additional steps ran
      expect(searchService.clearIndex).toHaveBeenCalled();
      expect(folderService.clearDecryptedFolderState).toHaveBeenCalled();

      expectUserToHaveLoggedOut("3"); // They have chosen logout as their action and it's available, log them out
      expectUserToHaveLoggedOut("4"); // They may have had lock as their chosen action but it's not available to them so logout
    });

    it("should lock an account if they haven't been active passed their vault timeout even if a view is open when they are not the active user.", async () => {
      setupAccounts(
        {
          1: {
            // Neither of these setup values ever get called
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            lastActive: new Date().getTime() - 80 * 1000, // Last active 80 seconds ago
            vaultTimeout: 1, // Vault timeout of 1 minute
          },
        },
        { userId: "2", isViewOpen: true },
      );

      await vaultTimeoutService.checkVaultTimeout();

      expectUserToHaveLocked("1");
    });

    it("should not lock an account that is active and we know that a view is open, even if they haven't been active passed their timeout", async () => {
      setupAccounts(
        {
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
            lastActive: new Date().getTime() - 80 * 1000, // Last active 80 seconds ago
            vaultTimeout: 1, // Vault timeout of 1 minute
          },
        },
        { userId: "1", isViewOpen: true }, // They are the currently active user
      );

      await vaultTimeoutService.checkVaultTimeout();

      expectNoAction("1");
    });
  });

  describe("lock", () => {
    const setupLock = () => {
      setupAccounts(
        {
          user1: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
          },
          user2: {
            authStatus: AuthenticationStatus.Unlocked,
            isAuthenticated: true,
          },
        },
        {
          userId: "user1",
        },
      );
    };

    it("should call state event runner with currently active user if no user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock();

      expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("lock", "user1");
    });

    it("should call locked callback with the locking user if no userID is passed in.", async () => {
      setupLock();

      await vaultTimeoutService.lock();

      expect(lockedCallback).toHaveBeenCalledWith("user1");
    });

    it("should call state event runner with user passed into lock", async () => {
      setupLock();

      const user2 = "user2" as UserId;

      await vaultTimeoutService.lock(user2);

      expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("lock", user2);
    });

    it("should call messaging service locked message with user passed into lock", async () => {
      setupLock();

      const user2 = "user2" as UserId;

      await vaultTimeoutService.lock(user2);

      expect(messagingService.send).toHaveBeenCalledWith("locked", { userId: user2 });
    });

    it("should call locked callback with user passed into lock", async () => {
      setupLock();

      const user2 = "user2" as UserId;

      await vaultTimeoutService.lock(user2);

      expect(lockedCallback).toHaveBeenCalledWith(user2);
    });
  });
});
