// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { map, Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  templateUrl: "subscription.component.html",
  standalone: false,
})
export class SubscriptionComponent implements OnInit {
  hasPremium$: Observable<boolean>;
  paymentDetailsPageData$: Observable<{
    route: string;
    textKey: string;
  }>;

  selfHosted: boolean;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    private configService: ConfigService,
  ) {
    this.hasPremium$ = accountService.activeAccount$.pipe(
      switchMap((account) => billingAccountProfileStateService.hasPremiumPersonally$(account.id)),
    );

    this.paymentDetailsPageData$ = this.configService
      .getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout)
      .pipe(
        map((managePaymentDetailsOutsideCheckout) =>
          managePaymentDetailsOutsideCheckout
            ? { route: "payment-details", textKey: "paymentDetails" }
            : { route: "payment-method", textKey: "paymentMethod" },
        ),
      );
  }

  ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }
}
