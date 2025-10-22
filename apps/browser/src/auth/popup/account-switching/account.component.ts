// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AvatarModule, ItemModule } from "@bitwarden/components";
import { BiometricsService } from "@bitwarden/key-management";

import { AccountSwitcherService, AvailableAccount } from "./services/account-switcher.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-account",
  templateUrl: "account.component.html",
  imports: [CommonModule, JslibModule, AvatarModule, ItemModule],
})
export class AccountComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() account: AvailableAccount;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() loading = new EventEmitter<boolean>();

  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private router: Router,
    private i18nService: I18nService,
    private logService: LogService,
    private biometricsService: BiometricsService,
  ) {}

  get specialAccountAddId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  async selectAccount(id: string) {
    this.loading.emit(true);
    let result;
    try {
      result = await this.accountSwitcherService.selectAccount(id);
    } catch (e) {
      this.logService.error("Error selecting account", e);
    }

    // Navigate out of account switching for unlocked accounts
    // locked or logged out account statuses are handled by background and app.component
    if (result?.authenticationStatus === AuthenticationStatus.Unlocked) {
      await this.router.navigate(["vault"]);
      await this.biometricsService.setShouldAutopromptNow(false);
    } else {
      await this.biometricsService.setShouldAutopromptNow(true);
    }
    this.loading.emit(false);
  }

  get status() {
    if (this.account.isActive) {
      return { text: this.i18nService.t("active"), icon: "bwi-check-circle" };
    }

    if (this.account.status === AuthenticationStatus.Unlocked) {
      return { text: this.i18nService.t("unlocked"), icon: "bwi-unlock" };
    }

    return { text: this.i18nService.t("locked"), icon: "bwi-lock" };
  }
}
