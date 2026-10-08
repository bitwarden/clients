import {
  combineLatest,
  defaultIfEmpty,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
} from "rxjs";

import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { Account, AccountService } from "../abstractions/account.service";
import { AuthService } from "../abstractions/auth.service";
import { AvatarService } from "../abstractions/avatar.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AccountSwitcherEntries } from "./account-switcher-entries.type";
import { AccountSwitcherEntry } from "./account-switcher-entry.type";
import { AccountSwitcherService } from "./account-switcher.service";
import { ActiveAccountResolution } from "./active-account-resolution.type";

/** The most accounts that can be not logged out at the same time. */
const MAX_ACCOUNTS = 5;

type UsableAccount = { account: Account; status: AuthenticationStatus; isActive: boolean };

const hasRoomForAnotherAccount = (usableAccounts: UsableAccount[]) =>
  usableAccounts.length < MAX_ACCOUNTS;

export class DefaultAccountSwitcherService implements AccountSwitcherService {
  readonly entries$: Observable<AccountSwitcherEntries>;
  readonly canAddAccount$: Observable<boolean>;
  readonly nextSwitchableAccount$: Observable<Account | null>;

  /** Every account that is not logged out, the active account included, most recently active first. */
  private readonly usableAccounts$: Observable<UsableAccount[]>;

  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly avatarService: AvatarService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.usableAccounts$ = combineLatest({
      accounts: this.accountService.accounts$,
      activeAccount: this.accountService.activeAccount$,
      sortedUserIds: this.accountService.sortedUserIds$,
      authStatuses: this.authService.authStatuses$,
    }).pipe(
      map(({ accounts, activeAccount, sortedUserIds, authStatuses }) =>
        sortedUserIds
          // Keep known accounts with a known status that is not logged out.
          .filter(
            (userId) =>
              accounts[userId] != null &&
              authStatuses[userId] != null &&
              authStatuses[userId] !== AuthenticationStatus.LoggedOut,
          )
          .map((userId) => ({
            account: { id: userId, ...accounts[userId] },
            status: authStatuses[userId],
            isActive: userId === activeAccount?.id,
          })),
      ),
    );

    this.entries$ = this.usableAccounts$.pipe(
      switchMap((usableAccounts) => this.toEntries$(usableAccounts)),
    );

    this.canAddAccount$ = this.usableAccounts$.pipe(map(hasRoomForAnotherAccount));

    this.nextSwitchableAccount$ = this.usableAccounts$.pipe(
      map(
        (usableAccounts) =>
          usableAccounts.find((usableAccount) => !usableAccount.isActive)?.account ?? null,
      ),
    );
  }

  async resolveActiveAccount(): Promise<ActiveAccountResolution> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      return { action: "keep" };
    }

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(activeAccount.id));
    if (authStatus !== AuthenticationStatus.LoggedOut) {
      return { action: "keep" };
    }

    const nextAccount = await firstValueFrom(this.nextSwitchableAccount$);
    return nextAccount == null
      ? { action: "clear" }
      : { action: "switch", targetUserId: nextAccount.id };
  }

  private toEntries$(usableAccounts: UsableAccount[]): Observable<AccountSwitcherEntries> {
    const activeUsableAccts = usableAccounts.find((usableAccount) => usableAccount.isActive);
    const inactiveUsableAccts = usableAccounts.filter((usableAccount) => !usableAccount.isActive);

    const activeEntry$ = activeUsableAccts == null ? of(null) : this.toEntry$(activeUsableAccts);
    const inactiveEntries$ = combineLatest(
      inactiveUsableAccts.map((activeUsableAccount) => this.toEntry$(activeUsableAccount)),
    ).pipe(
      // With no inactive accounts, combineLatest completes without a value. The combined result
      // below needs a value from every source before it emits.
      defaultIfEmpty([]),
    );

    return combineLatest({ active: activeEntry$, inactive: inactiveEntries$ }).pipe(
      map((entries) => ({ ...entries, canAddAccount: hasRoomForAnotherAccount(usableAccounts) })),
    );
  }

  private toEntry$({ account, status }: UsableAccount): Observable<AccountSwitcherEntry> {
    return combineLatest([
      this.avatarService.getUserAvatarColor$(account.id),
      this.environmentService.getEnvironment$(account.id),
    ]).pipe(
      map(([avatarColor, environment]) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        status,
        avatarColor,
        serverHostname: environment?.getHostname(),
      })),
    );
  }
}
