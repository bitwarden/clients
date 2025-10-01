import { DialogConfig } from "@angular/cdk/dialog";
import { Component, DestroyRef, Inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonType,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
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

export const UpgradeAccountDialogStatus = {
  Closed: "closed",
  ProceededToPayment: "proceeded-to-payment",
} as const;

export type UpgradeAccountDialogStatus = UnionOfValues<typeof UpgradeAccountDialogStatus>;

export type UpgradeAccountDialogResult = {
  status: UpgradeAccountDialogStatus;
  plan: PersonalSubscriptionPricingTierId | null;
};

/**
 * Parameters for upgrade account dialog
 */
export type UpgradeAccountDialogParams = {
  dialogTitleMessageOverride?: string;
};

type CardDetails = {
  title: string;
  tagline: string;
  price: { amount: number; cadence: SubscriptionCadence };
  button: { text: string; type: ButtonType };
  features: string[];
};

@Component({
  selector: "app-upgrade-account-dialog",
  imports: [DialogModule, SharedModule, BillingServicesModule, PricingCardComponent],
  templateUrl: "./upgrade-account-dialog.component.html",
})
export class UpgradeAccountDialogComponent implements OnInit {
  protected premiumCardDetails!: CardDetails;
  protected familiesCardDetails!: CardDetails;

  protected familiesPlanType = PersonalSubscriptionPricingTierIds.Families;
  protected premiumPlanType = PersonalSubscriptionPricingTierIds.Premium;
  protected loading = true;

  constructor(
    private dialogRef: DialogRef<UpgradeAccountDialogResult>,
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingService,
    private destroyRef: DestroyRef,
    @Inject(DIALOG_DATA) private dialogParams: UpgradeAccountDialogParams,
  ) {}

  dialogTitle: string = this.dialogParams.dialogTitleMessageOverride
    ? this.dialogParams.dialogTitleMessageOverride
    : "individualUpgradeWelcomeMessage";

  ngOnInit(): void {
    this.subscriptionPricingService
      .getPersonalSubscriptionPricingTiers$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((plans) => {
        this.setupCardDetails(plans);
        this.loading = false;
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
      features: tier.passwordManager.features.map((f: any) => f.value),
    };
  }

  protected onProceedClick(plan: PersonalSubscriptionPricingTierId): void {
    this.close({
      status: UpgradeAccountDialogStatus.ProceededToPayment,
      plan,
    });
  }

  private isFamiliesPlan(plan: PersonalSubscriptionPricingTierId): boolean {
    return plan === PersonalSubscriptionPricingTierIds.Families;
  }

  protected onCloseClick(): void {
    this.close({
      status: UpgradeAccountDialogStatus.Closed,
      plan: null,
    });
  }

  private close(result: UpgradeAccountDialogResult): void {
    this.dialogRef.close(result);
  }

  static open(
    dialogService: DialogService,
    dialogConfig: DialogConfig<UpgradeAccountDialogParams>,
  ): DialogRef<UpgradeAccountDialogResult> {
    return dialogService.open<UpgradeAccountDialogResult>(
      UpgradeAccountDialogComponent,
      dialogConfig,
    );
  }
}
