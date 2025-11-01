import { CommonModule, Location } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, firstValueFrom, map, of, startWith, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LockService, LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AvatarModule,
  ButtonModule,
  DialogService,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { enableAccountSwitching } from "../../../platform/flags";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AccountComponent } from "./account.component";
import { CurrentAccountComponent } from "./current-account.component";
import { AccountSwitcherService } from "./services/account-switcher.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "account-switcher.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    ItemModule,
    AvatarModule,
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
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  readonly lockedStatus = AuthenticationStatus.Locked;
  private destroy$ = new Subject<void>();

  loading = false;
  activeUserCanLock = false;
  enableAccountSwitching = true;

  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private accountService: AccountService,
    private vaultTimeoutService: VaultTimeoutService,
    private dialogService: DialogService,
    private location: Location,
    private router: Router,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private authService: AuthService,
    private lockService: LockService,
    private logoutService: LogoutService,
  ) {}

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
      if (!enableAccountSwitching()) {
        return of(false);
      }

      // When there are an inactive accounts provide the option to lock all accounts
      // Note: "Add account" is counted as an inactive account, so check for more than one account
      return of(accounts.length > 1);
    }),
  );

  async ngOnInit() {
    this.enableAccountSwitching = enableAccountSwitching();

    const availableVaultTimeoutActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
    );
    this.activeUserCanLock = availableVaultTimeoutActions.includes(VaultTimeoutAction.Lock);
  }

  back() {
    this.location.back();
  }

  async lock(userId: string) {
    this.loading = true;
    await this.vaultTimeoutService.lock(userId);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["lock"]);
  }

  async lockAll() {
    this.loading = true;
    await this.lockService.lockAll();
    await this.router.navigate(["lock"]);
  }

  async logOut(userId: UserId) {
    this.loading = true;
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
    this.loading = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
