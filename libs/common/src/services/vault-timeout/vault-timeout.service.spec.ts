import { MockProxy, any, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { SearchService } from "../../abstractions/search.service";
import { VaultTimeoutSettingsService } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Account } from "../../platform/models/domain/account";
import { StateEventRunnerService } from "../../platform/state";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { CollectionService } from "../../vault/abstractions/collection.service";
import { FolderService } from "../../vault/abstractions/folder/folder.service.abstraction";

import { VaultTimeoutService } from "./vault-timeout.service";

describe("VaultTimeoutService", () => {
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<FolderService>;
  let collectionService: MockProxy<CollectionService>;
  let cryptoService: MockProxy<CryptoService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let searchService: MockProxy<SearchService>;
  let stateService: MockProxy<StateService>;
  let authService: MockProxy<AuthService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let lockedCallback: jest.Mock<Promise<void>, [userId: string]>;
  let loggedOutCallback: jest.Mock<Promise<void>, [expired: boolean, userId?: string]>;

  let accountsSubject: BehaviorSubject<Record<string, Account>>;
  let vaultTimeoutActionSubject: BehaviorSubject<VaultTimeoutAction>;
  let availableVaultTimeoutActionsSubject: BehaviorSubject<VaultTimeoutAction[]>;

  let vaultTimeoutService: VaultTimeoutService;

  beforeEach(() => {
    cipherService = mock();
    folderService = mock();
    collectionService = mock();
    cryptoService = mock();
    platformUtilsService = mock();
    messagingService = mock();
    searchService = mock();
    stateService = mock();
    authService = mock();
    vaultTimeoutSettingsService = mock();
    stateEventRunnerService = mock();

    lockedCallback = jest.fn();
    loggedOutCallback = jest.fn();

    accountsSubject = new BehaviorSubject(null);

    stateService.accounts$ = accountsSubject;

    vaultTimeoutActionSubject = new BehaviorSubject(VaultTimeoutAction.Lock);

    vaultTimeoutSettingsService.vaultTimeoutAction$.mockReturnValue(vaultTimeoutActionSubject);

    availableVaultTimeoutActionsSubject = new BehaviorSubject<VaultTimeoutAction[]>([]);

    vaultTimeoutService = new VaultTimeoutService(
      cipherService,
      folderService,
      collectionService,
      cryptoService,
      platformUtilsService,
      messagingService,
      searchService,
      stateService,
      authService,
      vaultTimeoutSettingsService,
      stateEventRunnerService,
      lockedCallback,
      loggedOutCallback,
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
        vaultTimeout?: number;
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

    authService.getAuthStatus.mockImplementation((userId) => {
      return Promise.resolve(accounts[userId]?.authStatus);
    });
    stateService.getIsAuthenticated.mockImplementation((options) => {
      // Just like actual state service, if no userId is given fallback to active userId
      return Promise.resolve(accounts[options.userId ?? globalSetups?.userId]?.isAuthenticated);
    });

    vaultTimeoutSettingsService.getVaultTimeout.mockImplementation((userId) => {
      return Promise.resolve(accounts[userId]?.vaultTimeout);
    });

    stateService.getLastActive.mockImplementation((options) => {
      return Promise.resolve(accounts[options.userId]?.lastActive);
    });

    stateService.getUserId.mockResolvedValue(globalSetups?.userId);

    stateService.activeAccount$ = new BehaviorSubject<string>(globalSetups?.userId);

    platformUtilsService.isViewOpen.mockResolvedValue(globalSetups?.isViewOpen ?? false);

    vaultTimeoutSettingsService.vaultTimeoutAction$.mockImplementation((userId) => {
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

    const accountsSubjectValue: Record<string, Account> = Object.keys(accounts).reduce(
      (agg, key) => {
        const newPartial: Record<string, unknown> = {};
        newPartial[key] = null; // No values actually matter on this other than the key
        return Object.assign(agg, newPartial);
      },
      {} as Record<string, Account>,
    );
    accountsSubject.next(accountsSubjectValue);
  };

  const expectUserToHaveLocked = (userId: string) => {
    // This does NOT assert all the things that the lock process does
    expect(stateService.getIsAuthenticated).toHaveBeenCalledWith({ userId: userId });
    expect(vaultTimeoutSettingsService.availableVaultTimeoutActions$).toHaveBeenCalledWith(userId);
    expect(stateService.setEverBeenUnlocked).toHaveBeenCalledWith(true, { userId: userId });
    expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, { userId: userId });
    expect(cryptoService.clearUserKey).toHaveBeenCalledWith(false, userId);
    expect(cryptoService.clearMasterKey).toHaveBeenCalledWith(userId);
    expect(cipherService.clearCache).toHaveBeenCalledWith(userId);
    expect(lockedCallback).toHaveBeenCalledWith(userId);
  };

  const expectUserToHaveLoggedOut = (userId: string) => {
    expect(loggedOutCallback).toHaveBeenCalledWith(false, userId);
  };

  const expectNoAction = (userId: string) => {
    expect(lockedCallback).not.toHaveBeenCalledWith(userId);
    expect(loggedOutCallback).not.toHaveBeenCalledWith(any(), userId);
  };

  describe("checkVaultTimeout", () => {
    it.each([AuthenticationStatus.Locked, AuthenticationStatus.LoggedOut])(
      "should not try to log out or lock any user that has authStatus === %s.",
      async (authStatus) => {
        platformUtilsService.isViewOpen.mockResolvedValue(false);
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
      null, // never
      -1, // onRestart
      -2, // onLocked
      -3, // onSleep
      -4, // onIdle
    ])(
      "does not log out or lock a user who has %s as their vault timeout",
      async (vaultTimeout) => {
        setupAccounts({
          1: {
            authStatus: AuthenticationStatus.Unlocked,
            vaultTimeout: vaultTimeout,
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
      expect(folderService.clearCache).toHaveBeenCalled();

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

    it("should call messaging service locked message if no user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock();

      // Currently these pass `undefined` (or what they were given) as the userId back
      // but we could change this to give the user that was locked (active) to these methods
      // so they don't have to get it their own way, but that is a behavioral change that needs
      // to be tested.
      expect(messagingService.send).toHaveBeenCalledWith("locked", { userId: undefined });
    });

    it("should call locked callback if no user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock();

      // Currently these pass `undefined` (or what they were given) as the userId back
      // but we could change this to give the user that was locked (active) to these methods
      // so they don't have to get it their own way, but that is a behavioral change that needs
      // to be tested.
      expect(lockedCallback).toHaveBeenCalledWith(undefined);
    });

    it("should call state event runner with user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock("user2");

      expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("lock", "user2");
    });

    it("should call messaging service locked message with user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock("user2");

      expect(messagingService.send).toHaveBeenCalledWith("locked", { userId: "user2" });
    });

    it("should call locked callback with user passed into lock", async () => {
      setupLock();

      await vaultTimeoutService.lock("user2");

      expect(lockedCallback).toHaveBeenCalledWith("user2");
    });
  });
});
