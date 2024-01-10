import { Component, OnInit } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

@Component({
  templateUrl: "subscription.component.html",
})
export class SubscriptionComponent implements OnInit {
  hasPremium: boolean;
  selfHosted: boolean;

  constructor(
    private stateService: StateService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  async ngOnInit() {
    this.hasPremium = await this.stateService.getHasPremiumPersonally();
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }

  get subscriptionRoute(): string {
    return this.hasPremium ? "user-subscription" : "premium";
  }
}
