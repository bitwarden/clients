import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { BillingSharedModule } from "@bitwarden/web-vault/app/billing/shared";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./self-hosted-premium.component.html",
  imports: [SharedModule, BillingSharedModule],
})
export class SelfHostedPremiumComponent {
  cloudPremiumPageUrl$ = this.environmentService.cloudWebVaultUrl$.pipe(
    map((url) => `${url}/#/settings/subscription/premium`),
  );

  hasPremiumFromAnyOrganization$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      account
        ? this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id)
        : of(false),
    ),
  );

  hasPremiumPersonally$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      account
        ? this.billingAccountProfileStateService.hasPremiumPersonally$(account.id)
        : of(false),
    ),
  );

  onLicenseFileUploaded = async () => {
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("premiumUpdated"),
    });
    await this.navigateToSubscription();
  };

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private router: Router,
    private toastService: ToastService,
  ) {
    combineLatest([this.hasPremiumFromAnyOrganization$, this.hasPremiumPersonally$])
      .pipe(
        takeUntilDestroyed(),
        switchMap(([hasPremiumFromAnyOrganization, hasPremiumPersonally]) => {
          if (hasPremiumFromAnyOrganization) {
            return this.navigateToVault();
          }
          if (hasPremiumPersonally) {
            return this.navigateToSubscription();
          }

          return of(true);
        }),
      )
      .subscribe();
  }

  navigateToSubscription = () =>
    this.router.navigate(["../user-subscription"], { relativeTo: this.activatedRoute });
  navigateToVault = () => this.router.navigate(["/vault"]);
}
