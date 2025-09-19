import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonType,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { SharedModule } from "../../../../shared";
import { BillingServicesModule } from "../../../services";
import { SubscriptionPricingService } from "../../../services/subscription-pricing.service";
import { PersonalSubscriptionPricingTierIds } from "../../../types/subscription-pricing-tier";

/**
 * Result type for upgrade account dialog
 */
export type UpgradeAccountDialogResult = {
  status: UpgradeAccountDialogStatus;
  plan: DialogPlanType;
};

/**
 * Parameters for upgrade account dialog
 */
export type UpgradeAccountDialogParams = {
  organizationId: string | null;
};

/**
 * Card details for pricing display
 */
export type CardDetails = {
  title: string;
  tagline: string;
  price: { amount: number; cadence: "monthly" | "annually" };
  button: { text: string; type: ButtonType };
  features: string[];
};

/**
 * Status types for upgrade account dialog
 */
export const UpgradeAccountDialogStatus = {
  Closed: "closed",
  ProceededToPayment: "proceeded-to-payment",
} as const;

export type UpgradeAccountDialogStatus = UnionOfValues<typeof UpgradeAccountDialogStatus>;

/**
 * Plan types supported by upgrade dialogs
 */
export const DialogPlanType = {
  Premium: "premium",
  Families: "families",
  Teams: "teams",
  Enterprise: "enterprise",
  NotSupported: "not-supported",
} as const;

export type DialogPlanType = UnionOfValues<typeof DialogPlanType>;

@Component({
  selector: "app-upgrade-account-dialog",
  imports: [DialogModule, SharedModule, BillingServicesModule, PricingCardComponent],
  templateUrl: "./upgrade-account-dialog.component.html",
})
export class UpgradeAccountDialogComponent implements OnInit, OnDestroy {
  protected premiumCardDetails!: CardDetails;
  protected familiesCardDetails!: CardDetails;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: DialogRef<UpgradeAccountDialogResult>,
    private subscriptionPricingService: SubscriptionPricingService,
    @Inject(DIALOG_DATA) private dialogConfig: DialogConfig<UpgradeAccountDialogParams>,
  ) {}

  ngOnInit(): void {
    if (!this.dialogConfig.data?.organizationId) {
      this.loadPricingTiers();
    } else {
      // If an organizationId is provided, other plans (Teams, Enterprise) are not supported in this dialog
      this.close({ status: UpgradeAccountDialogStatus.Closed, plan: DialogPlanType.NotSupported });
    }
  }

  private loadPricingTiers(): void {
    this.subscriptionPricingService
      .getPersonalSubscriptionPricingTiers$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((pricingTiers) => {
        const premiumTier = pricingTiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium,
        );
        const familiesTier = pricingTiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Families,
        );

        if (premiumTier) {
          this.premiumCardDetails = this.createCardDetails(premiumTier, {
            defaultTitle: "Premium",
            defaultTagline: "Complete online security",
            buttonText: "Upgrade to Premium",
            buttonType: "primary",
          });
        }

        if (familiesTier) {
          this.familiesCardDetails = this.createCardDetails(familiesTier, {
            defaultTitle: "Families",
            defaultTagline: familiesTier.description,
            buttonText: "Upgrade to Families",
            buttonType: "secondary",
          });
        }
      });
  }

  private createCardDetails(
    tier: any,
    options: {
      defaultTitle: string;
      defaultTagline: string;
      buttonText: string;
      buttonType: "primary" | "secondary";
    },
  ): CardDetails {
    return {
      title: tier.name || options.defaultTitle,
      tagline: tier.description || options.defaultTagline,
      price: {
        amount: Number(tier.passwordManager.monthlyCost.toFixed(2)),
        cadence: "monthly",
      },
      button: { text: options.buttonText, type: options.buttonType },
      features: tier.passwordManager.features
        .map((f: any) => f.value)
        .filter((f: string) => f !== ""),
    };
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Close the dialog */
  private close(result: UpgradeAccountDialogResult) {
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

  onProceedClick(plan: DialogPlanType) {
    this.close({
      status: UpgradeAccountDialogStatus.ProceededToPayment,
      plan: plan,
    });
  }
}
