import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import {
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierId,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

import { AccountBillingClient, PreviewInvoiceClient } from "../../../clients";
import { BillingServicesModule } from "../../../services";
import { PremiumOrgUpgradeComponent } from "../premium-org-upgrade/premium-org-upgrade.component";
import {
  PremiumOrgUpgradePaymentComponent,
  PremiumOrgUpgradePaymentResult,
} from "../premium-org-upgrade-payment/premium-org-upgrade-payment.component";
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
  UpgradedToTeams: "upgradedToTeams",
  UpgradedToEnterprise: "upgradedToEnterprise",
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
  selectedPlan?: PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId | null;
  planSelectionStepTitleOverride?: string | null;
  hideContinueWithoutUpgradingButton?: boolean;
  redirectOnCompletion?: boolean;
};

@Component({
  selector: "app-unified-upgrade-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    UpgradeAccountComponent,
    UpgradePaymentComponent,
    BillingServicesModule,
    PremiumOrgUpgradeComponent,
    PremiumOrgUpgradePaymentComponent,
  ],
  providers: [UpgradePaymentService, AccountBillingClient, PreviewInvoiceClient],
  templateUrl: "./unified-upgrade-dialog.component.html",
})
export class UnifiedUpgradeDialogComponent implements OnInit {
  // Use signals for dialog state because inputs depend on parent component
  protected readonly step = signal<UnifiedUpgradeDialogStep>(
    UnifiedUpgradeDialogStep.PlanSelection,
  );
  protected readonly selectedPlan = signal<
    PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId | null
  >(null);
  protected readonly account = signal<Account | null>(null);
  protected readonly planSelectionStepTitleOverride = signal<string | null>(null);
  protected readonly hideContinueWithoutUpgradingButton = signal<boolean>(false);
  protected readonly hasPremiumInterest = signal(false);
  protected readonly hasPremiumPersonally = toSignal(
    this.billingAccountProfileStateService.hasPremiumPersonally$(this.params.account.id),
    { initialValue: false },
  );

  // Type-narrowed computed signal for app-upgrade-payment
  // When hasPremiumPersonally is false, selectedPlan will only contain PersonalSubscriptionPricingTierId
  protected readonly selectedPersonalPlanId = computed<PersonalSubscriptionPricingTierId | null>(
    () => this.selectedPlan() as PersonalSubscriptionPricingTierId | null,
  );

  protected readonly PaymentStep = UnifiedUpgradeDialogStep.Payment;
  protected readonly PlanSelectionStep = UnifiedUpgradeDialogStep.PlanSelection;

  constructor(
    private dialogRef: DialogRef<UnifiedUpgradeDialogResult>,
    @Inject(DIALOG_DATA) private params: UnifiedUpgradeDialogParams,
    private router: Router,
    private premiumInterestStateService: PremiumInterestStateService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.account.set(this.params.account);
    this.step.set(this.params.initialStep ?? UnifiedUpgradeDialogStep.PlanSelection);
    this.selectedPlan.set(this.params.selectedPlan ?? null);
    this.planSelectionStepTitleOverride.set(this.params.planSelectionStepTitleOverride ?? null);
    this.hideContinueWithoutUpgradingButton.set(
      this.params.hideContinueWithoutUpgradingButton ?? false,
    );

    /*
     * Check if the user has premium interest at the point we open the dialog.
     * If they do, record it on a component-level signal and clear the user's premium interest.
     * This prevents us from having to clear it at every dialog conclusion point.
     * */
    const hasPremiumInterest = await this.premiumInterestStateService.getPremiumInterest(
      this.params.account.id,
    );
    if (hasPremiumInterest) {
      this.hasPremiumInterest.set(true);
      await this.premiumInterestStateService.clearPremiumInterest(this.params.account.id);
    }
  }

  protected onPlanSelected(
    planId: PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId,
  ): void {
    this.selectedPlan.set(planId);
    this.nextStep();
  }
  protected async onCloseClicked(): Promise<void> {
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

  protected async previousStep(): Promise<void> {
    // If we are on the payment step and there was no initial step, go back to plan selection this is to prevent
    // going back to payment step if the dialog was opened directly to payment step
    if (this.step() === UnifiedUpgradeDialogStep.Payment && this.params?.initialStep == null) {
      this.step.set(UnifiedUpgradeDialogStep.PlanSelection);
      this.selectedPlan.set(null);
    } else {
      this.close({ status: UnifiedUpgradeDialogStatus.Closed });
    }
  }

  protected async onComplete(
    result: UpgradePaymentResult | PremiumOrgUpgradePaymentResult,
  ): Promise<void> {
    let status: UnifiedUpgradeDialogStatus;
    switch (result.status) {
      case "upgradedToTeams":
        status = UnifiedUpgradeDialogStatus.UpgradedToTeams;
        break;
      case "upgradedToEnterprise":
        status = UnifiedUpgradeDialogStatus.UpgradedToEnterprise;
        break;
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

    // Check premium interest and route to vault for marketing-initiated premium upgrades
    if (status === UnifiedUpgradeDialogStatus.UpgradedToPremium) {
      if (this.hasPremiumInterest()) {
        await this.router.navigate(["/vault"]);
        return; // Exit early, don't use redirectOnCompletion
      }
    }

    // Use redirectOnCompletion for standard upgrade flows
    if (
      this.params.redirectOnCompletion &&
      (status === UnifiedUpgradeDialogStatus.UpgradedToPremium ||
        status === UnifiedUpgradeDialogStatus.UpgradedToFamilies)
    ) {
      const redirectUrl =
        status === UnifiedUpgradeDialogStatus.UpgradedToFamilies
          ? `/organizations/${result.organizationId}/vault`
          : "/settings/subscription/user-subscription";
      await this.router.navigate([redirectUrl]);
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
