// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { canAccessEmergencyAccess } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { SvgModule } from "@bitwarden/components";

import { BillingFreeFamiliesNavItemComponent } from "../billing/shared/billing-free-families-nav-item.component";

import { WebLayoutModule } from "./web-layout.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-user-layout",
  templateUrl: "user-layout.component.html",
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    SvgModule,
    BillingFreeFamiliesNavItemComponent,
  ],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  protected readonly showEmergencyAccess: Signal<boolean>;
  protected hasFamilySponsorshipAvailable$: Observable<boolean>;
  protected showSponsoredFamilies$: Observable<boolean>;
  protected showSubscription$: Observable<boolean>;
  protected readonly sendEnabled$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId)),
    map((isDisabled) => !isDisabled),
  );
  protected consolidatedSessionTimeoutComponent$: Observable<boolean>;

  constructor(
    private syncService: SyncService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private policyService: PolicyService,
    private configService: ConfigService,
  ) {
    this.showSubscription$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        this.billingAccountProfileStateService.canViewSubscription$(account.id),
      ),
    );

    this.showEmergencyAccess = toSignal(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          canAccessEmergencyAccess(userId, this.configService, this.policyService),
        ),
      ),
    );

    this.consolidatedSessionTimeoutComponent$ = this.configService.getFeatureFlag$(
      FeatureFlag.ConsolidatedSessionTimeoutComponent,
    );
  }

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.syncService.fullSync(false);
  }
}
