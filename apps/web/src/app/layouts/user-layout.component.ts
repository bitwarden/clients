// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable, concatMap, combineLatest, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { IconModule } from "@bitwarden/components";

import { BillingFreeFamiliesNavItemComponent } from "../billing/shared/billing-free-families-nav-item.component";

import { PasswordManagerLogo } from "./password-manager-logo";
import { WebLayoutModule } from "./web-layout.module";

@Component({
  selector: "app-user-layout",
  templateUrl: "user-layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    IconModule,
    BillingFreeFamiliesNavItemComponent,
  ],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  isFreeFamilyFlagEnabled: boolean;
  protected hasFamilySponsorshipAvailable$: Observable<boolean>;
  protected showSponsoredFamilies$: Observable<boolean>;
  protected showSubscription$: Observable<boolean>;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private apiService: ApiService,
    private syncService: SyncService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");

    await this.syncService.fullSync(false);

    // We want to hide the subscription menu for organizations that provide premium.
    // Except if the user has premium personally or has a billing history.
    this.showSubscription$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        combineLatest([
          this.billingAccountProfileStateService.hasPremiumPersonally$(account.id),
          this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id),
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
        ),
      ),
    );
  }
}
