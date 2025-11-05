import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { catchError, EMPTY, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadence,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  ButtonType,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

type CardDetails = {
  title: string;
  tagline: string;
  price: { amount: number; cadence: SubscriptionCadence };
  button: { text: string; type: ButtonType; icon?: { type: string; position: "before" | "after" } };
  features: string[];
};

@Component({
  selector: "billing-premium-upgrade-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    IconButtonModule,
    TypographyModule,
    CdkTrapFocus,
    JslibModule,
  ],
  templateUrl: "./premium-upgrade-dialog.component.html",
})
export class PremiumUpgradeDialogComponent {
  protected cardDetails$: Observable<CardDetails | null> = this.subscriptionPricingService
    .getPersonalSubscriptionPricingTiers$()
    .pipe(
      map((tiers) => tiers.find((tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium)),
      map((tier) => this.mapPremiumTierToCardDetails(tier!)),
      catchError((error: unknown) => {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("error"),
          message: this.i18nService.t("unexpectedError"),
        });
        this.logService.error("Error fetching and mapping pricing tiers", error);
        this.dialogRef.close();
        return EMPTY;
      }),
    );

  constructor(
    private dialogRef: DialogRef,
    private subscriptionPricingService: SubscriptionPricingServiceAbstraction,
    private i18nService: I18nService,
    private toastService: ToastService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
  ) {}

  protected async upgrade(): Promise<void> {
    const environment = await firstValueFrom(this.environmentService.environment$);
    let vaultUrl = environment.getWebVaultUrl() + "/#/settings/subscription/premium";
    if (environment.getRegion() !== Region.SelfHosted) {
      vaultUrl += "?callToAction=upgradeToPremium";
    }
    this.platformUtilsService.launchUri(vaultUrl);
    this.dialogRef.close();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private mapPremiumTierToCardDetails(tier: PersonalSubscriptionPricingTier): CardDetails {
    return {
      title: tier.name,
      tagline: tier.description,
      price: {
        amount: tier.passwordManager.annualPrice / 12,
        cadence: SubscriptionCadenceIds.Monthly,
      },
      button: {
        text: this.i18nService.t("upgradeNow"),
        type: "primary",
        icon: { type: "bwi-external-link", position: "after" },
      },
      features: tier.passwordManager.features.map((f) => f.value),
    };
  }

  /**
   * Opens the premium upgrade dialog.
   *
   * @param dialogService - The dialog service used to open the component
   * @returns A dialog reference object
   */
  static open(dialogService: DialogService): DialogRef<PremiumUpgradeDialogComponent> {
    return dialogService.open(PremiumUpgradeDialogComponent);
  }
}
