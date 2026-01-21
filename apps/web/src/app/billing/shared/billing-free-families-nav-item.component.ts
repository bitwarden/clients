import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { BillingSharedModule } from "@bitwarden/angular/billing/shared";
import { NavigationModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { FreeFamiliesPolicyService } from "../services/free-families-policy.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "billing-free-families-nav-item",
  templateUrl: "./billing-free-families-nav-item.component.html",
  imports: [NavigationModule, BillingSharedModule, HeaderModule],
})
export class BillingFreeFamiliesNavItemComponent {
  showFreeFamilies$: Observable<boolean>;

  constructor(private freeFamiliesPolicyService: FreeFamiliesPolicyService) {
    this.showFreeFamilies$ = this.freeFamiliesPolicyService.showFreeFamilies$;
  }
}
