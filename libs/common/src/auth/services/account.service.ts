import { Subject, combineLatestWith, map, distinctUntilChanged, shareReplay } from "rxjs";

import {
  AccountInfo,
  InternalAccountService,
  accountInfoEqual,
} from "../../auth/abstractions/account.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import {
  ACCOUNT_MEMORY,
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

export const ACCOUNT_ACCOUNTS = KeyDefinition.record<AccountInfo, UserId>(
  ACCOUNT_MEMORY,
  "accounts",
  {
    deserializer: (accountInfo) => accountInfo,
  },
);

export const ACCOUNT_ACTIVE_ACCOUNT_ID = new KeyDefinition(ACCOUNT_MEMORY, "activeAccountId", {
  deserializer: (id: UserId) => id,
});

export class AccountServiceImplementation implements InternalAccountService {
  private lock = new Subject<UserId>();
  private logout = new Subject<UserId>();
  private accountsState: GlobalState<Record<UserId, AccountInfo>>;
  private activeAccountIdState: GlobalState<UserId | undefined>;

  accounts$;
  activeAccount$;
  accountLock$ = this.lock.asObservable();
  accountLogout$ = this.logout.asObservable();

  constructor(
    private messagingService: MessagingService,
    private logService: LogService,
    private globalStateProvider: GlobalStateProvider,
  ) {
    this.accountsState = this.globalStateProvider.get(ACCOUNT_ACCOUNTS);
    this.activeAccountIdState = this.globalStateProvider.get(ACCOUNT_ACTIVE_ACCOUNT_ID);

    this.accounts$ = this.accountsState.state$.pipe(
      map((accounts) => (accounts == null ? {} : accounts)),
    );
    this.activeAccount$ = this.activeAccountIdState.state$.pipe(
      combineLatestWith(this.accounts$),
      map(([id, accounts]) => (id ? { id, ...accounts[id] } : undefined)),
      distinctUntilChanged((a, b) => a?.id === b?.id && accountInfoEqual(a, b)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  async addAccount(userId: UserId, accountData: AccountInfo): Promise<void> {
    await this.accountsState.update((accounts) => {
      accounts ||= {};
      accounts[userId] = accountData;
      return accounts;
    });
  }

  async setAccountName(userId: UserId, name: string): Promise<void> {
    await this.setAccountInfo(userId, { name });
  }

  async setAccountEmail(userId: UserId, email: string): Promise<void> {
    await this.setAccountInfo(userId, { email });
  }

  async setAccountStatus(userId: UserId, status: AuthenticationStatus): Promise<void> {
    await this.setAccountInfo(userId, { status });

    if (status === AuthenticationStatus.LoggedOut) {
      this.logout.next(userId);
    } else if (status === AuthenticationStatus.Locked) {
      this.lock.next(userId);
    }
  }

  async setMaxAccountStatus(userId: UserId, maxStatus: AuthenticationStatus): Promise<void> {
    await this.accountsState.update(
      (accounts) => {
        accounts[userId].status = maxStatus;
        return accounts;
      },
      {
        shouldUpdate: (accounts) => {
          if (accounts?.[userId] == null) {
            throw new Error("Account does not exist");
          }

          return accounts[userId].status > maxStatus;
        },
      },
    );
  }

  async switchAccount(userId: UserId): Promise<void> {
    await this.activeAccountIdState.update(
      (_, accounts) => {
        if (userId == null) {
          // indicates no account is active
          return null;
        }

        if (accounts?.[userId] == null) {
          throw new Error("Account does not exist");
        }
        return userId;
      },
      {
        combineLatestWith: this.accounts$,
        shouldUpdate: (id) => {
          // update only if userId changes
          return id !== userId;
        },
      },
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
