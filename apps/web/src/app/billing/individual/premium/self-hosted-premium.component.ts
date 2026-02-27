import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  DialogService,
  LinkModule,
  SectionComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpdateLicenseDialogComponent } from "../../shared/update-license-dialog.component";
import { UpdateLicenseDialogResult } from "../../shared/update-license-types";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./self-hosted-premium.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SectionComponent,
    BadgeModule,
    TypographyModule,
    LinkModule,
    I18nPipe,
    PricingCardComponent,
  ],
})
export class SelfHostedPremiumComponent {
  protected cloudPremiumPageUrl$ = this.environmentService.cloudWebVaultUrl$.pipe(
    map((url) => `${url}/#/settings/subscription/premium`),
  );

  protected cloudFamiliesPageUrl$ = this.environmentService.cloudWebVaultUrl$.pipe(
    map((url) => `${url}/#/settings/subscription/premium`),
  );

  protected hasPremiumFromAnyOrganization$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id)
          : of(false),
      ),
    );

  protected hasPremiumPersonally$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      account
        ? this.billingAccountProfileStateService.hasPremiumPersonally$(account.id)
        : of(false),
    ),
  );

  protected shouldShowUpgradeView$: Observable<boolean> = this.hasPremiumPersonally$.pipe(
    map((hasPremium) => !hasPremium),
  );

  protected premiumFeatures = [
    this.i18nService.t("builtInAuthenticator"),
    this.i18nService.t("secureFileStorage"),
    this.i18nService.t("emergencyAccess"),
    this.i18nService.t("breachMonitoring"),
    this.i18nService.t("andMoreFeatures"),
  ];

  protected familiesFeatures = [
    this.i18nService.t("premiumAccounts"),
    this.i18nService.t("familiesUnlimitedSharing"),
    this.i18nService.t("familiesUnlimitedCollections"),
    this.i18nService.t("familiesSharedStorage"),
  ];

  private destroyRef = inject(DestroyRef);

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private router: Router,
    private toastService: ToastService,
  ) {
    // Redirect premium users to subscription page
    this.hasPremiumPersonally$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((hasPremiumPersonally) => {
          if (hasPremiumPersonally) {
            return this.navigateToSubscription();
          }
          return of(true);
        }),
      )
      .subscribe();
  }

  protected openUploadLicenseDialog = async () => {
    const dialogRef = UpdateLicenseDialogComponent.open(this.dialogService);
    const result = await lastValueFrom(dialogRef.closed);
    if (result === UpdateLicenseDialogResult.Updated) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("premiumUpdated"),
      });
      await this.navigateToSubscription();
    }
  };

  protected navigateToSubscription = async (): Promise<boolean> =>
    this.router.navigate(["../user-subscription"], { relativeTo: this.activatedRoute });

  protected onPremiumUpgradeClick = async () => {
    const url = await firstValueFrom(this.cloudPremiumPageUrl$);
    if (!url) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("cloudUrlNotConfigured"),
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  protected onFamiliesUpgradeClick = async () => {
    const url = await firstValueFrom(this.cloudFamiliesPageUrl$);
    if (!url) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("cloudUrlNotConfigured"),
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };
}
