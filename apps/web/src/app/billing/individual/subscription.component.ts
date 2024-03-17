import { Component, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  templateUrl: "subscription.component.html",
})
export class SubscriptionComponent implements OnInit {
  hasPremium$: Observable<boolean>;
  selfHosted: boolean;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.hasPremium$ = billingAccountProfileStateService.hasPremiumPersonally$;
  }

  ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }
}
