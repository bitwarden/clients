import { matches, mock } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject, firstValueFrom, of, timeout } from "rxjs";

import {
  Account,
  AccountInfo,
  AccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AccountSwitcherService } from "./account-switcher.service";

describe("AccountSwitcherService", () => {
  let accountsSubject: BehaviorSubject<Record<UserId, AccountInfo>>;
  let activeAccountSubject: BehaviorSubject<Account | null>;
  let authStatusSubject: ReplaySubject<Record<UserId, AuthenticationStatus>>;

  let envBSubject: BehaviorSubject<Environment | undefined>;
  const mockHostName = "mockHostName";
  const mockEnv: Partial<Environment> = {
    getHostname: () => mockHostName,
  };

  const accountService = mock<AccountService>();
  const avatarService = mock<AvatarService>();
  const messagingService = mock<MessagingService>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  const authService = mock<AuthService>();

  let accountSwitcherService: AccountSwitcherService;

  beforeEach(() => {
    jest.resetAllMocks();
    accountsSubject = new BehaviorSubject<Record<UserId, AccountInfo>>(null);
    activeAccountSubject = new BehaviorSubject<Account | null>(null);
    authStatusSubject = new ReplaySubject<Record<UserId, AuthenticationStatus>>(1);

    // Use subject to allow for easy updates
    accountService.accounts$ = accountsSubject;
    accountService.activeAccount$ = activeAccountSubject;
    authService.authStatuses$ = authStatusSubject;

    envBSubject = new BehaviorSubject<Environment | undefined>(mockEnv as Environment);
    environmentService.getEnvironment$.mockReturnValue(envBSubject);

    accountSwitcherService = new AccountSwitcherService(
      accountService,
      avatarService,
      messagingService,
      environmentService,
      logService,
      authService,
    );
  });

  afterEach(() => {
    accountsSubject.complete();
    activeAccountSubject.complete();
    authStatusSubject.complete();
  });

  describe("availableAccounts$", () => {
    it("should return all logged in accounts and an add account option when accounts are less than 5", async () => {
      const accountInfo: AccountInfo = {
        name: "Test User 1",
        email: "test1@email.com",
        emailVerified: true,
      };

      avatarService.getUserAvatarColor$.mockReturnValue(of("#cccccc"));
      accountsSubject.next({ ["1" as UserId]: accountInfo, ["2" as UserId]: accountInfo });
      authStatusSubject.next({
        ["1" as UserId]: AuthenticationStatus.Unlocked,
        ["2" as UserId]: AuthenticationStatus.Locked,
      });
      activeAccountSubject.next(Object.assign(accountInfo, { id: "1" as UserId }));

      const accounts = await firstValueFrom(
        accountSwitcherService.availableAccounts$.pipe(timeout(20)),
      );
      expect(accounts).toHaveLength(3);
      expect(accounts[0].id).toBe("1");
      expect(accounts[0].isActive).toBeTruthy();

      expect(accounts[0].server).toBe(mockHostName);

      expect(accounts[1].id).toBe("2");
      expect(accounts[1].isActive).toBeFalsy();
      expect(accounts[1].server).toBe(mockHostName);

      expect(accounts[2].id).toBe("addAccount");
      expect(accounts[2].isActive).toBeFalsy();
      expect(accounts[2].server).toBe(undefined);
    });

    it.each([5, 6])(
      "should return only accounts if there are %i accounts",
      async (numberOfAccounts) => {
        const seedAccounts: Record<UserId, AccountInfo> = {};
        const seedStatuses: Record<UserId, AuthenticationStatus> = {};
        for (let i = 0; i < numberOfAccounts; i++) {
          seedAccounts[`${i}` as UserId] = {
            email: `test${i}@email.com`,
            emailVerified: true,
            name: "Test User ${i}",
          };
          seedStatuses[`${i}` as UserId] = AuthenticationStatus.Unlocked;
        }
        avatarService.getUserAvatarColor$.mockReturnValue(of("#cccccc"));
        accountsSubject.next(seedAccounts);
        authStatusSubject.next(seedStatuses);
        activeAccountSubject.next(
          Object.assign(seedAccounts["1" as UserId], { id: "1" as UserId }),
        );

        const accounts = await firstValueFrom(accountSwitcherService.availableAccounts$);

        expect(accounts).toHaveLength(numberOfAccounts);
        accounts.forEach((account) => {
          expect(account.id).not.toBe("addAccount");
        });
      },
    );

    it("excludes logged out accounts", async () => {
      const user1AccountInfo: AccountInfo = {
        name: "Test User 1",
        email: "",
        emailVerified: true,
      };
      accountsSubject.next({ ["1" as UserId]: user1AccountInfo });
      authStatusSubject.next({ ["1" as UserId]: AuthenticationStatus.LoggedOut });
      accountsSubject.next({
        "1": user1AccountInfo,
      } as Record<UserId, AccountInfo>);

      const accounts = await firstValueFrom(
        accountSwitcherService.availableAccounts$.pipe(timeout(20)),
      );

      // Add account only
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe("addAccount");
    });
  });

  describe("selectAccount", () => {
    it("initiates an add account logic when add account is selected", async () => {
      let listener: (
        message: { command: string; userId: string },
        sender: unknown,
        sendResponse: unknown,
      ) => void = null;
      jest.spyOn(chrome.runtime.onMessage, "addListener").mockImplementation((addedListener) => {
        listener = addedListener;
      });

      const removeListenerSpy = jest.spyOn(chrome.runtime.onMessage, "removeListener");

      const selectAccountPromise = accountSwitcherService.selectAccount("addAccount");

      expect(listener).not.toBeNull();
      listener({ command: "switchAccountFinish", userId: null }, undefined, undefined);

      await selectAccountPromise;

      expect(messagingService.send).toHaveBeenCalledWith("switchAccount", { userId: null });

      expect(removeListenerSpy).toBeCalledTimes(1);
    });

    it("initiates an account switch with an account id", async () => {
      let listener: (
        message: { command: string; userId: string },
        sender: unknown,
        sendResponse: unknown,
      ) => void;
      jest.spyOn(chrome.runtime.onMessage, "addListener").mockImplementation((addedListener) => {
        listener = addedListener;
      });

      const removeListenerSpy = jest.spyOn(chrome.runtime.onMessage, "removeListener");

      const selectAccountPromise = accountSwitcherService.selectAccount("1");

      listener({ command: "switchAccountFinish", userId: "1" }, undefined, undefined);

      await selectAccountPromise;

      expect(messagingService.send).toHaveBeenCalledWith("switchAccount", { userId: "1" });
      expect(messagingService.send).toBeCalledWith(
        "switchAccount",
        matches((payload) => {
          return payload.userId === "1";
        }),
      );
      expect(removeListenerSpy).toBeCalledTimes(1);
    });
  });

  describe("logout", () => {
    const userId1 = "1" as UserId;
    const userId2 = "2" as UserId;
    it("initiates logout", async () => {
      let listener: (
        message: { command: string; userId: UserId; status: AuthenticationStatus },
        sender: unknown,
        sendResponse: unknown,
      ) => void;
      jest.spyOn(chrome.runtime.onMessage, "addListener").mockImplementation((addedListener) => {
        listener = addedListener;
      });

      const removeListenerSpy = jest.spyOn(chrome.runtime.onMessage, "removeListener");

      const logoutPromise = accountSwitcherService.logoutAccount(userId1);

      listener(
        { command: "switchAccountFinish", userId: userId2, status: AuthenticationStatus.Unlocked },
        undefined,
        undefined,
      );

      const result = await logoutPromise;

      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId: userId1 });
      expect(result).toEqual({ newUserId: userId2, status: AuthenticationStatus.Unlocked });
      expect(removeListenerSpy).toBeCalledTimes(1);
    });
  });
});
