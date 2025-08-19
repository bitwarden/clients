// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  combineLatestWith,
  map,
  distinctUntilChanged,
  shareReplay,
  combineLatest,
  Observable,
  switchMap,
  filter,
  timeout,
  of,
} from "rxjs";

import {
  Account,
  AccountInfo,
  InternalAccountService,
  accountInfoEqual,
} from "../../auth/abstractions/account.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { Utils } from "../../platform/misc/utils";
import {
  ACCOUNT_DISK,
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SingleUserStateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";

export const ACCOUNT_ACCOUNTS = KeyDefinition.record<AccountInfo, UserId>(
  ACCOUNT_DISK,
  "accounts",
  {
    deserializer: (accountInfo) => accountInfo,
  },
);

export const ACCOUNT_ACTIVE_ACCOUNT_ID = new KeyDefinition(ACCOUNT_DISK, "activeAccountId", {
  deserializer: (id: UserId) => id,
});

export const ACCOUNT_ACTIVITY = KeyDefinition.record<Date, UserId>(ACCOUNT_DISK, "activity", {
  deserializer: (activity) => new Date(activity),
});

export const ACCOUNT_VERIFY_NEW_DEVICE_LOGIN = new UserKeyDefinition<boolean>(
  ACCOUNT_DISK,
  "verifyNewDeviceLogin",
  {
    deserializer: (verifyDevices) => verifyDevices,
    clearOn: ["logout"],
  },
);

const LOGGED_OUT_INFO: AccountInfo = {
  email: "",
  emailVerified: false,
  name: undefined,
};

/**
 * An rxjs map operator that extracts the UserId from an account, or throws if the account or UserId are null.
 */
export const getUserId = map<Account | null, UserId>((account) => {
  if (account == null) {
    throw new Error("Null or undefined account");
  }

  return account.id;
});

/**
 * An rxjs map operator that extracts the UserId from an account, or returns undefined if the account or UserId are null.
 */
export const getOptionalUserId = map<Account | null, UserId | null>(
  (account) => account?.id ?? null,
);

export class AccountServiceImplementation implements InternalAccountService {
  private accountsState: GlobalState<Record<UserId, AccountInfo>>;
  private activeAccountIdState: GlobalState<UserId | undefined>;

  accounts$: Observable<Record<UserId, AccountInfo>>;
  activeAccount$: Observable<Account | null>;
  accountActivity$: Observable<Record<UserId, Date>>;
  accountVerifyNewDeviceLogin$: Observable<boolean>;
  sortedUserIds$: Observable<UserId[]>;
  nextUpAccount$: Observable<Account>;

  constructor(
    private messagingService: MessagingService,
    private logService: LogService,
    private globalStateProvider: GlobalStateProvider,
    private singleUserStateProvider: SingleUserStateProvider,
  ) {
    this.accountsState = this.globalStateProvider.get(ACCOUNT_ACCOUNTS);
    this.activeAccountIdState = this.globalStateProvider.get(ACCOUNT_ACTIVE_ACCOUNT_ID);

    this.accounts$ = this.accountsState.state$.pipe(
      map((accounts) => (accounts == null ? {} : accounts)),
    );
    this.activeAccount$ = this.activeAccountIdState.state$.pipe(
      combineLatestWith(this.accounts$),
      map(([id, accounts]) => (id ? ({ id, ...(accounts[id] as AccountInfo) } as Account) : null)),
      distinctUntilChanged((a, b) => a?.id === b?.id && accountInfoEqual(a, b)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.accountActivity$ = this.globalStateProvider
      .get(ACCOUNT_ACTIVITY)
      .state$.pipe(map((activity) => activity ?? {}));
    this.sortedUserIds$ = this.accountActivity$.pipe(
      map((activity) => {
        return Object.entries(activity)
          .map(([userId, lastActive]: [UserId, Date]) => ({ userId, lastActive }))
          .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime()) // later dates first
          .map((a) => a.userId);
      }),
    );
    this.nextUpAccount$ = combineLatest([
      this.accounts$,
      this.activeAccount$,
      this.sortedUserIds$,
    ]).pipe(
      map(([accounts, activeAccount, sortedUserIds]) => {
        const nextId = sortedUserIds.find((id) => id !== activeAccount?.id && accounts[id] != null);
        return nextId ? { id: nextId, ...accounts[nextId] } : null;
      }),
    );
    this.accountVerifyNewDeviceLogin$ = this.activeAccountIdState.state$.pipe(
      switchMap(
        (userId) =>
          this.singleUserStateProvider.get(userId, ACCOUNT_VERIFY_NEW_DEVICE_LOGIN).state$,
      ),
    );
  }

  async addAccount(userId: UserId, accountData: AccountInfo): Promise<void> {
    if (!Utils.isGuid(userId)) {
      throw new Error("userId is required");
    }

    await this.accountsState.update((accounts) => {
      accounts ||= {};
      accounts[userId] = accountData;
      return accounts;
    });
    await this.setAccountActivity(userId, new Date());
  }

  async setAccountName(userId: UserId, name: string): Promise<void> {
    await this.setAccountInfo(userId, { name });
  }

  async setAccountEmail(userId: UserId, email: string): Promise<void> {
    await this.setAccountInfo(userId, { email });
  }

  async setAccountEmailVerified(userId: UserId, emailVerified: boolean): Promise<void> {
    await this.setAccountInfo(userId, { emailVerified });
  }

  async clean(userId: UserId) {
    await this.setAccountInfo(userId, LOGGED_OUT_INFO);
    await this.removeAccountActivity(userId);
  }

  async switchAccount(userId: UserId | null): Promise<void> {
    let updateActivity = false;
    await this.activeAccountIdState.update(
      (_, __) => {
        updateActivity = true;
        return userId;
      },
      {
        combineLatestWith: this.accountsState.state$.pipe(
          filter((accounts) => {
            if (userId == null) {
              // Don't worry about accounts when we are about to set active user to null
              return true;
            }

            return accounts?.[userId] != null;
          }),
          // If we don't get the desired account with enough time, just return empty as that will result in the same error
          timeout({ first: 1000, with: () => of({} as Record<UserId, AccountInfo>) }),
        ),
        shouldUpdate: (id, accounts) => {
          if (userId != null && accounts?.[userId] == null) {
            throw new Error("Account does not exist");
          }

          // update only if userId changes
          return id !== userId;
        },
      },
    );

    if (updateActivity) {
      await this.setAccountActivity(userId, new Date());
    }
  }

  async setAccountActivity(userId: UserId, lastActivity: Date): Promise<void> {
    if (!Utils.isGuid(userId)) {
      // only store for valid userIds
      return;
    }

    await this.globalStateProvider.get(ACCOUNT_ACTIVITY).update(
      (activity) => {
        activity ||= {};
        activity[userId] = lastActivity;
        return activity;
      },
      {
        shouldUpdate: (oldActivity) => oldActivity?.[userId]?.getTime() !== lastActivity?.getTime(),
      },
    );
  }

  async setAccountVerifyNewDeviceLogin(
    userId: UserId,
    setVerifyNewDeviceLogin: boolean,
  ): Promise<void> {
    if (!Utils.isGuid(userId)) {
      // only store for valid userIds
      return;
    }

    await this.singleUserStateProvider
      .get(userId, ACCOUNT_VERIFY_NEW_DEVICE_LOGIN)
      .update(() => setVerifyNewDeviceLogin, {
        shouldUpdate: (previousValue) => previousValue !== setVerifyNewDeviceLogin,
      });
  }

  async removeAccountActivity(userId: UserId): Promise<void> {
    await this.globalStateProvider.get(ACCOUNT_ACTIVITY).update(
      (activity) => {
        if (activity == null) {
          return activity;
        }
        delete activity[userId];
        return activity;
      },
      { shouldUpdate: (oldActivity) => oldActivity?.[userId] != null },
    );
  }

  // TODO: update to use our own account status settings. Requires inverting direction of state service accounts flow
  async delete(): Promise<void> {
    try {
      this.messagingService?.send("logout");
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  }

  private async setAccountInfo(userId: UserId, update: Partial<AccountInfo>): Promise<void> {
    function newAccountInfo(oldAccountInfo: AccountInfo): AccountInfo {
      return { ...oldAccountInfo, ...update };
    }
    await this.accountsState.update(
      (accounts) => {
        accounts[userId] = newAccountInfo(accounts[userId]);
        return accounts;
      },
      {
        // Avoid unnecessary updates
        // TODO: Faster comparison, maybe include a hash on the objects?
        shouldUpdate: (accounts) => {
          if (accounts?.[userId] == null) {
            throw new Error("Account does not exist");
          }

          return !accountInfoEqual(accounts[userId], newAccountInfo(accounts[userId]));
        },
      },
    );
  }
}
