// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "subscription.component.html",
  standalone: false,
})
export class SubscriptionComponent implements OnInit {
  showSubscriptionPageLink$: Observable<boolean>;
  selfHosted: boolean;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
  ) {
    this.showSubscriptionPageLink$ = accountService.activeAccount$.pipe(
      switchMap((account) =>
        account ? billingAccountProfileStateService.hasPremiumPersonally$(account.id) : of(false),
      ),
    );
  }

  ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }
}
