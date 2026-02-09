import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  OnInit,
  output,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, catchError, of } from "rxjs";

import { SubscriptionPricingCardDetails } from "@bitwarden/angular/billing/types/subscription-pricing-card-details";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonType, DialogModule, ToastService } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { SharedModule } from "../../../../shared";
import { BillingServicesModule } from "../../../services";
export const PremiumOrgUpgradeStatus = {
  Closed: "closed",
  ProceededToPayment: "proceeded-to-payment",
} as const;

export type PremiumOrgUpgradeStatus = UnionOfValues<typeof PremiumOrgUpgradeStatus>;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-premium-org-upgrade-plan-selection",
  imports: [
    CommonModule,
    DialogModule,
    SharedModule,
    BillingServicesModule,
    PricingCardComponent,
    CdkTrapFocus,
  ],
  templateUrl: "./premium-org-upgrade-plan-selection.component.html",
})
export class PremiumOrgUpgradePlanSelectionComponent implements OnInit {
  planSelected = output<PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId>();
  closeClicked = output<PremiumOrgUpgradeStatus>();
  protected closedStatus = PremiumOrgUpgradeStatus.Closed;

  protected readonly loading = signal(true);
  protected familiesCardDetails!: SubscriptionPricingCardDetails;
  protected teamsCardDetails!: SubscriptionPricingCardDetails;
  protected enterpriseCardDetails!: SubscriptionPricingCardDetails;

  protected familiesPlanType = PersonalSubscriptionPricingTierIds.Families;
  protected teamsPlanType = BusinessSubscriptionPricingTierIds.Teams;
  protected enterprisePlanType = BusinessSubscriptionPricingTierIds.Enterprise;

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingServiceAbstraction,
    private toastService: ToastService,
    private destroyRef: DestroyRef,
  ) {}

  async ngOnInit(): Promise<void> {
    combineLatest([
      this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$(),
      this.subscriptionPricingService.getBusinessSubscriptionPricingTiers$(),
    ])
      .pipe(
        catchError((error: unknown) => {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("unexpectedError"),
          });
          this.loading.set(false);
          return of([[], []]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([personalPlans, businessPlans]) => {
        this.setupCardDetails(personalPlans, businessPlans);
        this.loading.set(false);
      });
  }

  private setupCardDetails(
    personalPlans: PersonalSubscriptionPricingTier[],
    businessPlans: BusinessSubscriptionPricingTier[],
  ): void {
    const familiesTier = personalPlans.find(
      (tier) => tier.id === PersonalSubscriptionPricingTierIds.Families,
    );
    const teamsTier = businessPlans.find(
      (tier) => tier.id === BusinessSubscriptionPricingTierIds.Teams,
    );
    const enterpriseTier = businessPlans.find(
      (tier) => tier.id === BusinessSubscriptionPricingTierIds.Enterprise,
    );

    if (familiesTier) {
      this.familiesCardDetails = this.createCardDetails(familiesTier, "primary");
    }

    if (teamsTier) {
      this.teamsCardDetails = this.createCardDetails(teamsTier, "secondary");
    }

    if (enterpriseTier) {
      this.enterpriseCardDetails = this.createCardDetails(enterpriseTier, "secondary");
    }
  }

  private createCardDetails(
    tier: PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier,
    buttonType: ButtonType,
  ): SubscriptionPricingCardDetails {
    let buttonText: string;
    switch (tier.id) {
      case PersonalSubscriptionPricingTierIds.Families:
        buttonText = "upgradeToFamilies";
        break;
      case BusinessSubscriptionPricingTierIds.Teams:
        buttonText = "upgradeToTeams";
        break;
      case BusinessSubscriptionPricingTierIds.Enterprise:
        buttonText = "upgradeToEnterprise";
        break;
      default:
        buttonText = "";
    }

    let priceAmount: number | undefined;
    let shouldShowPerUser = false;

    if ("annualPrice" in tier.passwordManager) {
      priceAmount = tier.passwordManager.annualPrice;
    } else if ("annualPricePerUser" in tier.passwordManager) {
      priceAmount = tier.passwordManager.annualPricePerUser;
      shouldShowPerUser = true;
    }

    return {
      title: tier.name,
      tagline: tier.description,
      price:
        priceAmount && priceAmount > 0
          ? {
              amount: priceAmount / 12,
              cadence: "month",
              showPerUser: shouldShowPerUser,
            }
          : undefined,
      button: {
        text: this.i18nService.t(buttonText),
        type: buttonType,
      },
      features: tier.passwordManager.features.map((f: { key: string; value: string }) => f.value),
    };
  }
}
