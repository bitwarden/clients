import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, computed, input, output, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of } from "rxjs";

import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadence,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonType, DialogModule, ToastService } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { SharedModule } from "../../../../shared";
import { BillingServicesModule } from "../../../services";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  readonly dialogTitleMessageOverride = input<string | null>(null);
  readonly hideContinueWithoutUpgradingButton = input<boolean>(false);
  planSelected = output<PersonalSubscriptionPricingTierId>();
  closeClicked = output<UpgradeAccountStatus>();
  protected readonly loading = signal(true);
  protected premiumCardDetails!: CardDetails;
  protected familiesCardDetails!: CardDetails;

  protected familiesPlanType = PersonalSubscriptionPricingTierIds.Families;
  protected premiumPlanType = PersonalSubscriptionPricingTierIds.Premium;
  protected closeStatus = UpgradeAccountStatus.Closed;

  protected readonly dialogTitle = computed(() => {
    return this.dialogTitleMessageOverride() || "individualUpgradeWelcomeMessage";
  });

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingServiceAbstraction,
    private toastService: ToastService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.subscriptionPricingService
      .getPersonalSubscriptionPricingTiers$()
      .pipe(
        catchError((error: unknown) => {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("unexpectedError"),
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
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
          this.isFamiliesPlan(tier.id) ? "startFreeFamiliesTrial" : "upgradeToPremium",
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
