import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { catchError, EMPTY, firstValueFrom, map, Observable } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PremiumCheckoutSessionPlatform } from "@bitwarden/common/billing/models/request/premium-checkout-session.request";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { JslibModule } from "../../../jslib.module";
import { SubscriptionPricingCardDetails } from "../../types/subscription-pricing-card-details";

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
  protected readonly upgrading = signal(false);

  protected readonly cardDetails$: Observable<SubscriptionPricingCardDetails | null> =
    this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$().pipe(
      map((tiers) => tiers.find((tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium)),
      map((tier) => this.mapPremiumTierToCardDetails(tier!)),
      catchError((error: unknown) => {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("error"),
          message: this.i18nService.t("unexpectedError"),
        });
        this.logService.error("Error fetching and mapping pricing tiers", error);
        void this.dialogRef.close();
        return EMPTY;
      }),
    );

  constructor(
    private readonly dialogRef: DialogRef,
    private readonly subscriptionPricingService: SubscriptionPricingServiceAbstraction,
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
    private readonly environmentService: EnvironmentService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly billingApiService: BillingApiServiceAbstraction,
  ) {}

  protected async upgrade(): Promise<void> {
    if (this.upgrading()) {
      return;
    }
    this.upgrading.set(true);

    try {
      const environment = await firstValueFrom(this.environmentService.environment$);
      const checkoutFlagEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.PM34515_BrowserDesktopCheckout,
      );
      // QA-only: lets a self-hosted-region client behave as cloud for premium
      // checkout. Off by default; only delivered by servers that enable it.
      const bypassSelfHostCheck = await this.configService.getFeatureFlag(
        FeatureFlag.DebugDisableSelfHostPremiumCheck,
      );
      const platform = this.resolveCheckoutPlatform();

      if (
        checkoutFlagEnabled &&
        (environment.isCloud() || bypassSelfHostCheck) &&
        platform != null
      ) {
        const { checkoutSessionUrl } = await this.billingApiService.createPremiumCheckoutSession({
          platform,
        });
        this.platformUtilsService.launchUri(checkoutSessionUrl);
      } else {
        const vaultUrl =
          environment.getWebVaultUrl() +
          "/#/settings/subscription/premium?callToAction=upgradeToPremium";
        this.platformUtilsService.launchUri(vaultUrl);
      }
    } catch (error: unknown) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: this.i18nService.t("unexpectedError"),
      });
      this.logService.error("Failed to start premium upgrade", error);
    } finally {
      this.upgrading.set(false);
      void this.dialogRef.close();
    }
  }

  private resolveCheckoutPlatform(): PremiumCheckoutSessionPlatform | null {
    switch (this.platformUtilsService.getClientType()) {
      case ClientType.Browser:
        return "browser";
      case ClientType.Desktop:
        return "desktop";
      default:
        return null;
    }
  }

  protected close(): void {
    void this.dialogRef.close();
  }

  private mapPremiumTierToCardDetails(
    tier: PersonalSubscriptionPricingTier,
  ): SubscriptionPricingCardDetails {
    return {
      title: tier.name,
      tagline: tier.description,
      price: tier.passwordManager.annualPrice
        ? {
            amount: tier.passwordManager.annualPrice / 12,
            cadence: SubscriptionCadenceIds.Monthly,
          }
        : undefined,
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
    return dialogService.open(PremiumUpgradeDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
