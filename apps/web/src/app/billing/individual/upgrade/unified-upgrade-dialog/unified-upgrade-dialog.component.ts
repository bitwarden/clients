import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { PersonalSubscriptionPricingTierId } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

import { AccountBillingClient, TaxClient } from "../../../clients";
import { BillingServicesModule } from "../../../services";
import { UpgradeAccountComponent } from "../upgrade-account/upgrade-account.component";
import { UpgradePaymentService } from "../upgrade-payment/services/upgrade-payment.service";
import {
  UpgradePaymentComponent,
  UpgradePaymentResult,
} from "../upgrade-payment/upgrade-payment.component";

export const UnifiedUpgradeDialogStatus = {
  Closed: "closed",
  UpgradedToPremium: "upgradedToPremium",
  UpgradedToFamilies: "upgradedToFamilies",
} as const;

export const UnifiedUpgradeDialogStep = {
  PlanSelection: "planSelection",
  Payment: "payment",
} as const;

export type UnifiedUpgradeDialogStatus = UnionOfValues<typeof UnifiedUpgradeDialogStatus>;
export type UnifiedUpgradeDialogStep = UnionOfValues<typeof UnifiedUpgradeDialogStep>;

export type UnifiedUpgradeDialogResult = {
  status: UnifiedUpgradeDialogStatus;
  organizationId?: string | null;
};

/**
 * Parameters for the UnifiedUpgradeDialog component.
 * In order to open the dialog to a specific step, you must provide the `initialStep` parameter and a `selectedPlan` if the step is `Payment`.
 *
 * @property {Account} account - The user account information.
 * @property {UnifiedUpgradeDialogStep | null} [initialStep] - The initial step to show in the dialog, if any.
 * @property {PersonalSubscriptionPricingTierId | null} [selectedPlan] - Pre-selected subscription plan, if any.
 * @property {string | null} [dialogTitleMessageOverride] - Optional custom i18n key to override the default dialog title.
 * @property {boolean} [hideContinueWithoutUpgradingButton] - Whether to hide the "Continue without upgrading" button.
 * @property {boolean} [redirectOnCompletion] - Whether to redirect after successful upgrade. Premium upgrades redirect to subscription settings, Families upgrades redirect to organization vault.
 */
export type UnifiedUpgradeDialogParams = {
  account: Account;
  initialStep?: UnifiedUpgradeDialogStep | null;
  selectedPlan?: PersonalSubscriptionPricingTierId | null;
  planSelectionStepTitleOverride?: string | null;
  hideContinueWithoutUpgradingButton?: boolean;
  redirectOnCompletion?: boolean;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-unified-upgrade-dialog",
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    UpgradeAccountComponent,
    UpgradePaymentComponent,
    BillingServicesModule,
  ],
  providers: [UpgradePaymentService, AccountBillingClient, TaxClient],
  templateUrl: "./unified-upgrade-dialog.component.html",
})
export class UnifiedUpgradeDialogComponent implements OnInit {
  // Use signals for dialog state because inputs depend on parent component
  protected readonly step = signal<UnifiedUpgradeDialogStep>(
    UnifiedUpgradeDialogStep.PlanSelection,
  );
  protected readonly selectedPlan = signal<PersonalSubscriptionPricingTierId | null>(null);
  protected readonly account = signal<Account | null>(null);
  protected readonly planSelectionStepTitleOverride = signal<string | null>(null);
  protected readonly hideContinueWithoutUpgradingButton = signal<boolean>(false);

  protected readonly PaymentStep = UnifiedUpgradeDialogStep.Payment;
  protected readonly PlanSelectionStep = UnifiedUpgradeDialogStep.PlanSelection;

  constructor(
    private dialogRef: DialogRef<UnifiedUpgradeDialogResult>,
    @Inject(DIALOG_DATA) private params: UnifiedUpgradeDialogParams,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.account.set(this.params.account);
    this.step.set(this.params.initialStep ?? UnifiedUpgradeDialogStep.PlanSelection);
    this.selectedPlan.set(this.params.selectedPlan ?? null);
    this.planSelectionStepTitleOverride.set(this.params.planSelectionStepTitleOverride ?? null);
    this.hideContinueWithoutUpgradingButton.set(
      this.params.hideContinueWithoutUpgradingButton ?? false,
    );
  }

  protected onPlanSelected(planId: PersonalSubscriptionPricingTierId): void {
    this.selectedPlan.set(planId);
    this.nextStep();
  }
  protected onCloseClicked(): void {
    this.close({ status: UnifiedUpgradeDialogStatus.Closed });
  }

  private close(result: UnifiedUpgradeDialogResult): void {
    this.dialogRef.close(result);
  }

  protected nextStep() {
    if (this.step() === UnifiedUpgradeDialogStep.PlanSelection) {
      this.step.set(UnifiedUpgradeDialogStep.Payment);
    }
  }

  protected previousStep(): void {
    // If we are on the payment step and there was no initial step, go back to plan selection this is to prevent
    // going back to payment step if the dialog was opened directly to payment step
    if (this.step() === UnifiedUpgradeDialogStep.Payment && this.params?.initialStep == null) {
      this.step.set(UnifiedUpgradeDialogStep.PlanSelection);
      this.selectedPlan.set(null);
    } else {
      this.close({ status: UnifiedUpgradeDialogStatus.Closed });
    }
  }

  protected onComplete(result: UpgradePaymentResult): void {
    let status: UnifiedUpgradeDialogStatus;
    switch (result.status) {
      case "upgradedToPremium":
        status = UnifiedUpgradeDialogStatus.UpgradedToPremium;
        break;
      case "upgradedToFamilies":
        status = UnifiedUpgradeDialogStatus.UpgradedToFamilies;
        break;
      case "closed":
        status = UnifiedUpgradeDialogStatus.Closed;
        break;
      default:
        status = UnifiedUpgradeDialogStatus.Closed;
    }

    this.close({ status, organizationId: result.organizationId });

    if (
      this.params.redirectOnCompletion &&
      (status === UnifiedUpgradeDialogStatus.UpgradedToPremium ||
        status === UnifiedUpgradeDialogStatus.UpgradedToFamilies)
    ) {
      const redirectUrl =
        status === UnifiedUpgradeDialogStatus.UpgradedToFamilies
          ? `/organizations/${result.organizationId}/vault`
          : "/settings/subscription/user-subscription";
      void this.router.navigate([redirectUrl]);
    }
  }

  /**
   * Opens the unified upgrade dialog.
   *
   * @param dialogService - The dialog service used to open the component
   * @param dialogConfig - The configuration for the dialog including UnifiedUpgradeDialogParams data
   * @returns A dialog reference object of type DialogRef<UnifiedUpgradeDialogResult>
   */
  static open(
    dialogService: DialogService,
    dialogConfig: DialogConfig<UnifiedUpgradeDialogParams>,
  ): DialogRef<UnifiedUpgradeDialogResult> {
    return dialogService.open<UnifiedUpgradeDialogResult>(UnifiedUpgradeDialogComponent, {
      data: dialogConfig.data,
    });
  }
}
