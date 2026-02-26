// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { combineLatest, from, map, Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AccountBillingClient } from "../clients/account-billing.client";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "subscription.component.html",
  standalone: false,
  providers: [AccountBillingClient],
})
export class SubscriptionComponent implements OnInit {
  showSubscriptionPageLink$: Observable<boolean>;
  selfHosted: boolean;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    configService: ConfigService,
    accountBillingClient: AccountBillingClient,
  ) {
    this.showSubscriptionPageLink$ = combineLatest([
      configService.getFeatureFlag$(FeatureFlag.PM29594_UpdateIndividualSubscriptionPage),
      accountService.activeAccount$,
    ]).pipe(
      switchMap(([isFeatureFlagEnabled, account]) => {
        if (isFeatureFlagEnabled) {
          return from(accountBillingClient.getSubscription()).pipe(
            map((subscription) => !!subscription),
          );
        }
        return billingAccountProfileStateService.hasPremiumPersonally$(account.id);
      }),
    );
  }

  ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }
}
