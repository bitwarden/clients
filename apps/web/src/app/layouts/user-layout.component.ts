import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable, combineLatest, concatMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction as ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { IconModule, LayoutComponent, NavigationModule } from "@bitwarden/components";

import { PaymentMethodWarningsModule } from "../billing/shared";

import { PasswordManagerLogo } from "./password-manager-logo";

@Component({
  selector: "app-user-layout",
  templateUrl: "user-layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LayoutComponent,
    IconModule,
    NavigationModule,
    PaymentMethodWarningsModule,
  ],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  protected hasFamilySponsorshipAvailable$: Observable<boolean>;
  protected showSubscription$: Observable<boolean>;

  protected showPaymentMethodWarningBanners$ = this.configService.getFeatureFlag$(
    FeatureFlag.ShowPaymentMethodWarningBanners,
    false,
  );

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private organizationService: OrganizationService,
    private apiService: ApiService,
    private syncService: SyncService,
    private configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");

    await this.syncService.fullSync(false);

    this.hasFamilySponsorshipAvailable$ = this.organizationService.canManageSponsorships$;

    // We want to hide the subscription menu for organizations that provide premium.
    // Except if the user has premium personally or has a billing history.
    this.showSubscription$ = combineLatest([
      this.billingAccountProfileStateService.hasPremiumPersonally$,
      this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$,
    ]).pipe(
      concatMap(async ([hasPremiumPersonally, hasPremiumFromOrg]) => {
        const isCloud = !this.platformUtilsService.isSelfHost();

        let billing = null;
        if (isCloud) {
          // TODO: We should remove the need to call this!
          billing = await this.apiService.getUserBillingHistory();
        }

        const cloudAndBillingHistory = isCloud && !billing?.hasNoHistory;
        return hasPremiumPersonally || !hasPremiumFromOrg || cloudAndBillingHistory;
      }),
    );
  }
}
