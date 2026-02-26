// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

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
import { UserId } from "@bitwarden/user-core";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

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
  providers: [AccountBillingClient],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  protected readonly showEmergencyAccess: Signal<boolean>;
  protected readonly sendEnabled$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId)),
    map((isDisabled) => !isDisabled),
  );
  protected consolidatedSessionTimeoutComponent$: Observable<boolean>;
  protected hasPremiumFromAnyOrganization$: Observable<boolean>;
  protected hasSubscription$: Observable<boolean>;
  protected subscriptionRoute$: Observable<string | null>;

  constructor(
    private syncService: SyncService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private policyService: PolicyService,
    private configService: ConfigService,
    private accountBillingClient: AccountBillingClient,
  ) {
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

    this.hasPremiumFromAnyOrganization$ = this.ifAccountExistsCheck((userId) =>
      this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(userId),
    );

    this.hasSubscription$ = this.ifAccountExistsCheck(() =>
      from(this.accountBillingClient.getSubscription()).pipe(
        map((subscription) => !!subscription),
        catchError(() => of(false)),
      ),
    );

    this.subscriptionRoute$ = combineLatest([
      this.hasSubscription$,
      this.hasPremiumFromAnyOrganization$,
    ]).pipe(
      map(([hasSubscription, hasPremiumFromAnyOrganization]) => {
        if (!hasPremiumFromAnyOrganization || hasSubscription) {
          return hasSubscription
            ? "settings/subscription/user-subscription"
            : "settings/subscription/premium";
        }
        return null;
      }),
    );
  }

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.syncService.fullSync(false);
  }

  private ifAccountExistsCheck(predicate$: (userId: UserId) => Observable<boolean>) {
    return this.accountService.activeAccount$.pipe(
      switchMap((account) => (account ? predicate$(account.id) : of(false))),
    );
  }
}
