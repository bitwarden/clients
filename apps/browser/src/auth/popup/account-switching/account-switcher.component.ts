import { CommonModule, Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, firstValueFrom, map, of, startWith, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LockService, LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AvatarModule,
  ButtonModule,
  DialogService,
  IconModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AccountComponent } from "./account.component";
import { CurrentAccountComponent } from "./current-account.component";
import { AccountSwitcherService } from "./services/account-switcher.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "account-switcher.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    ItemModule,
    AvatarModule,
    IconModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    AccountComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class AccountSwitcherComponent implements OnInit {
  readonly lockedStatus = AuthenticationStatus.Locked;

  readonly loading = signal(false);
  readonly activeUserCanLock = signal(false);
  readonly enableAccountSwitching$: Observable<boolean>;

  constructor(
    private readonly accountSwitcherService: AccountSwitcherService,
    private readonly accountService: AccountService,
    private readonly dialogService: DialogService,
    private readonly location: Location,
    private readonly router: Router,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly authService: AuthService,
    private readonly lockService: LockService,
    private readonly logoutService: LogoutService,
  ) {
    this.enableAccountSwitching$ = this.accountSwitcherService.accountSwitchingEnabled$();
  }

  get accountLimit() {
    return this.accountSwitcherService.ACCOUNT_LIMIT;
  }

  get specialAddAccountId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  readonly availableAccounts$ = this.accountSwitcherService.availableAccounts$;
  readonly currentAccount$ = this.accountService.activeAccount$.pipe(
    switchMap((a) =>
      a == null
        ? of(null)
        : this.authService.activeAccountStatus$.pipe(map((s) => ({ ...a, status: s }))),
    ),
  );

  readonly showLockAll$ = this.availableAccounts$.pipe(
    startWith([]),
    map((accounts) => accounts.filter((a) => !a.isActive)),
    switchMap((accounts) => {
      // If account switching is disabled, don't show the lock all button
      // as only one account should be shown.
      return this.accountSwitcherService.accountSwitchingEnabled$().pipe(
        switchMap((enabled) => {
          if (!enabled) {
            return of(false);
          }

          // When there are inactive accounts provide the option to lock all accounts
          // Note: "Add account" is counted as an inactive account, so check for more than one account
          return of(accounts.length > 1);
        }),
      );
    }),
  );

  async ngOnInit() {
    const availableVaultTimeoutActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
    );
    this.activeUserCanLock.set(availableVaultTimeoutActions.includes(VaultTimeoutAction.Lock));
  }

  back() {
    this.location.back();
  }

  async lock(userId: string) {
    this.loading.set(true);
    await this.lockService.lock(userId as UserId);
    await this.router.navigate(["lock"]);
  }

  async lockAll() {
    this.loading.set(true);
    await this.lockService.lockAll();
    await this.router.navigate(["lock"]);
  }

  async logOut(userId: UserId) {
    this.loading.set(true);
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: "info",
    });

    if (confirmed) {
      await this.logoutService.logout(userId);
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    }
    this.loading.set(false);
  }
}
