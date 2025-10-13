import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, output, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonType, DialogModule } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { SharedModule } from "../../../../shared";
import { BillingServicesModule } from "../../../services";
import { SubscriptionPricingService } from "../../../services/subscription-pricing.service";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadence,
  SubscriptionCadenceIds,
} from "../../../types/subscription-pricing-tier";

export const UpgradeAccountStatus = {
  Closed: "closed",
  ProceededToPayment: "proceeded-to-payment",
} as const;

export type UpgradeAccountStatus = UnionOfValues<typeof UpgradeAccountStatus>;

export type UpgradeAccountResult = {
  status: UpgradeAccountStatus;
  plan: PersonalSubscriptionPricingTierId | null;
};

type CardDetails = {
  title: string;
  tagline: string;
  price: { amount: number; cadence: SubscriptionCadence };
  button: { text: string; type: ButtonType };
  features: string[];
};

@Component({
  selector: "app-upgrade-account",
  imports: [
    CommonModule,
    DialogModule,
    SharedModule,
    BillingServicesModule,
    PricingCardComponent,
    CdkTrapFocus,
  ],
  templateUrl: "./upgrade-account.component.html",
})
export class UpgradeAccountComponent implements OnInit {
  planSelected = output<PersonalSubscriptionPricingTierId>();
  closeClicked = output<UpgradeAccountStatus>();
  protected loading = signal(true);
  protected premiumCardDetails!: CardDetails;
  protected familiesCardDetails!: CardDetails;

  protected familiesPlanType = PersonalSubscriptionPricingTierIds.Families;
  protected premiumPlanType = PersonalSubscriptionPricingTierIds.Premium;
  protected closeStatus = UpgradeAccountStatus.Closed;

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.subscriptionPricingService
      .getPersonalSubscriptionPricingTiers$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((plans) => {
        this.setupCardDetails(plans);
        this.loading.set(false);
      });
  }

  /** Setup card details for the pricing tiers.
   * This can be extended in the future for business plans, etc.
   */
  private setupCardDetails(plans: PersonalSubscriptionPricingTier[]): void {
    const premiumTier = plans.find(
      (tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium,
    );
    const familiesTier = plans.find(
      (tier) => tier.id === PersonalSubscriptionPricingTierIds.Families,
    );

    if (premiumTier) {
      this.premiumCardDetails = this.createCardDetails(premiumTier, "primary");
    }

    if (familiesTier) {
      this.familiesCardDetails = this.createCardDetails(familiesTier, "secondary");
    }
  }

  private createCardDetails(
    tier: PersonalSubscriptionPricingTier,
    buttonType: ButtonType,
  ): CardDetails {
    return {
      title: tier.name,
      tagline: tier.description,
      price: {
        amount: tier.passwordManager.annualPrice / 12,
        cadence: SubscriptionCadenceIds.Monthly,
      },
      button: {
        text: this.i18nService.t(
          this.isFamiliesPlan(tier.id) ? "upgradeToFamilies" : "upgradeToPremium",
        ),
        type: buttonType,
      },
      features: tier.passwordManager.features.map((f: { key: string; value: string }) => f.value),
    };
  }

  private isFamiliesPlan(plan: PersonalSubscriptionPricingTierId): boolean {
    return plan === PersonalSubscriptionPricingTierIds.Families;
  }
}
