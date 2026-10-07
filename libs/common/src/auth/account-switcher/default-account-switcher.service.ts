import { combineLatest, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { Account, AccountService } from "../abstractions/account.service";
import { AuthService } from "../abstractions/auth.service";
import { AvatarService } from "../abstractions/avatar.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AccountSwitcherEntry } from "./account-switcher-entry.type";
import { AccountSwitcherService } from "./account-switcher.service";
import { ActiveAccountResolution } from "./active-account-resolution.type";

type UsableAccount = { account: Account; status: AuthenticationStatus; isActive: boolean };

export class DefaultAccountSwitcherService implements AccountSwitcherService {
  readonly entries$: Observable<AccountSwitcherEntry[]>;
  readonly nextSwitchableAccount$: Observable<Account | null>;

  /** Every account that is not logged out, the active account included, most recently active first. */
  private readonly usableAccounts$: Observable<UsableAccount[]>;

  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly avatarService: AvatarService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.usableAccounts$ = combineLatest([
      this.accountService.accounts$,
      this.accountService.activeAccount$,
      this.accountService.sortedUserIds$,
      this.authService.authStatuses$,
    ]).pipe(
      map(([accounts, activeAccount, sortedUserIds, authStatuses]) =>
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
      switchMap((usableAccounts) =>
        usableAccounts.length === 0
          ? of([])
          : combineLatest(usableAccounts.map((usableAccount) => this.toEntry$(usableAccount))),
      ),
    );

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
    return nextAccount == null ? { action: "clear" } : { action: "switch", userId: nextAccount.id };
  }

  private toEntry$({ account, status, isActive }: UsableAccount): Observable<AccountSwitcherEntry> {
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
        server: environment?.getHostname(),
        isActive,
      })),
    );
  }
}
