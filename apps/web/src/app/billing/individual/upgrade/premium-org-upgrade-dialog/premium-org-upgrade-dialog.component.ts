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

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import {
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierId,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
import {
  PremiumOrgUpgradePaymentComponent,
  PremiumOrgUpgradePaymentResult,
} from "../premium-org-upgrade-payment/premium-org-upgrade-payment.component";
import { PremiumOrgUpgradePlanSelectionComponent } from "../premium-org-upgrade-plan-selection/premium-org-upgrade-plan-selection.component";
import { UpgradePaymentService } from "../upgrade-payment/services/upgrade-payment.service";

export const PremiumOrgUpgradeDialogStatus = {
  Closed: "closed",
  UpgradedToFamilies: "upgradedToFamilies",
  UpgradedToTeams: "upgradedToTeams",
  UpgradedToEnterprise: "upgradedToEnterprise",
} as const;

export const PremiumOrgUpgradeDialogStep = {
  PlanSelection: "planSelection",
  Payment: "payment",
} as const;

export type PremiumOrgUpgradeDialogStatus = UnionOfValues<typeof PremiumOrgUpgradeDialogStatus>;
export type PremiumOrgUpgradeDialogStep = UnionOfValues<typeof PremiumOrgUpgradeDialogStep>;

export type PremiumOrgUpgradeDialogResult = {
  status: PremiumOrgUpgradeDialogStatus;
  organizationId?: string | null;
};

/**
 * Parameters for the PremiumOrgUpgradeDialog component.
 * In order to open the dialog to a specific step, you must provide the `initialStep` parameter and a `selectedPlan` if the step is `Payment`.
 *
 * @property {Account} account - The user account information.
 * @property {PremiumOrgUpgradeDialogStep | null} [initialStep] - The initial step to open the dialog to, if any.
 * @property {BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId | null} [selectedPlan] - Pre-selected subscription plan, if any.
 * @property {boolean} [redirectOnCompletion] - Whether to redirect after successful upgrade to organization vault.
 */
export type PremiumOrgUpgradeDialogParams = {
  account: Account;
  initialStep?: PremiumOrgUpgradeDialogStep | null;
  selectedPlan?: BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId | null;
  redirectOnCompletion?: boolean;
};

@Component({
  selector: "app-premium-org-upgrade-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    BillingServicesModule,
    PremiumOrgUpgradePlanSelectionComponent,
    PremiumOrgUpgradePaymentComponent,
  ],
  providers: [UpgradePaymentService, AccountBillingClient, PreviewInvoiceClient],
  templateUrl: "./premium-org-upgrade-dialog.component.html",
})
export class PremiumOrgUpgradeDialogComponent implements OnInit {
  // Use signals for dialog state because inputs depend on parent component
  protected readonly step = signal<PremiumOrgUpgradeDialogStep>(
    PremiumOrgUpgradeDialogStep.PlanSelection,
  );
  protected readonly selectedPlan = signal<
    BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId | null
  >(null);
  protected readonly account = signal<Account | null>(null);
  protected readonly hasPremiumPersonally = toSignal(
    this.billingAccountProfileStateService.hasPremiumPersonally$(this.params.account.id),
    { initialValue: false },
  );
  protected readonly premiumToOrganizationUpgradeEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM29593_PremiumToOrganizationUpgrade),
    { initialValue: false },
  );
  protected readonly showPremiumToOrganizationUpgrade = computed(
    () => this.hasPremiumPersonally() && this.premiumToOrganizationUpgradeEnabled(),
  );

  protected readonly PaymentStep = PremiumOrgUpgradeDialogStep.Payment;
  protected readonly PlanSelectionStep = PremiumOrgUpgradeDialogStep.PlanSelection;

  constructor(
    private dialogRef: DialogRef<PremiumOrgUpgradeDialogResult>,
    @Inject(DIALOG_DATA) private params: PremiumOrgUpgradeDialogParams,
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private configService: ConfigService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.showPremiumToOrganizationUpgrade()) {
      // If the premium to organization upgrade feature is not enabled or user does not have premium personally, close the dialog
      this.close({ status: PremiumOrgUpgradeDialogStatus.Closed });
      return;
    }
    this.account.set(this.params.account);
    this.step.set(this.params.initialStep ?? PremiumOrgUpgradeDialogStep.PlanSelection);
    this.selectedPlan.set(this.params.selectedPlan ?? null);
  }

  protected onPlanSelected(
    planId: BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId,
  ): void {
    this.selectedPlan.set(planId);
    this.nextStep();
  }

  protected async onCloseClicked(): Promise<void> {
    this.close({ status: PremiumOrgUpgradeDialogStatus.Closed });
  }

  private close(result: PremiumOrgUpgradeDialogResult): void {
    this.dialogRef.close(result);
  }

  protected nextStep() {
    if (this.step() === PremiumOrgUpgradeDialogStep.PlanSelection) {
      this.step.set(PremiumOrgUpgradeDialogStep.Payment);
    }
  }

  protected async previousStep(): Promise<void> {
    // If we are on the payment step and there was no initial step, go back to plan selection this is to prevent
    // going back to payment step if the dialog was opened directly to payment step
    if (this.step() === PremiumOrgUpgradeDialogStep.Payment && this.params?.initialStep == null) {
      this.step.set(PremiumOrgUpgradeDialogStep.PlanSelection);
      this.selectedPlan.set(null);
    } else {
      this.close({ status: PremiumOrgUpgradeDialogStatus.Closed });
    }
  }

  protected async onComplete(result: PremiumOrgUpgradePaymentResult): Promise<void> {
    let status: PremiumOrgUpgradeDialogStatus;
    switch (result.status) {
      case "upgradedToFamilies":
        status = PremiumOrgUpgradeDialogStatus.UpgradedToFamilies;
        break;
      case "upgradedToTeams":
        status = PremiumOrgUpgradeDialogStatus.UpgradedToTeams;
        break;
      case "upgradedToEnterprise":
        status = PremiumOrgUpgradeDialogStatus.UpgradedToEnterprise;
        break;
      case "closed":
        status = PremiumOrgUpgradeDialogStatus.Closed;
        break;
      default:
        status = PremiumOrgUpgradeDialogStatus.Closed;
    }

    this.close({ status, organizationId: result.organizationId });

    // Redirect to organization vault after successful upgrade
    if (
      this.params.redirectOnCompletion &&
      (status === PremiumOrgUpgradeDialogStatus.UpgradedToFamilies ||
        status === PremiumOrgUpgradeDialogStatus.UpgradedToEnterprise ||
        status === PremiumOrgUpgradeDialogStatus.UpgradedToTeams)
    ) {
      const redirectUrl = `/organizations/${result.organizationId}/vault`;
      await this.router.navigate([redirectUrl]);
    }
  }

  /**
   * Opens the premium org upgrade dialog.
   *
   * @param dialogService - The dialog service used to open the component
   * @param dialogConfig - The configuration for the dialog including PremiumOrgUpgradeDialogParams data
   * @returns A dialog reference object of type DialogRef<PremiumOrgUpgradeDialogResult>
   */
  static open(
    dialogService: DialogService,
    dialogConfig: DialogConfig<PremiumOrgUpgradeDialogParams>,
  ): DialogRef<PremiumOrgUpgradeDialogResult> {
    return dialogService.open<PremiumOrgUpgradeDialogResult>(PremiumOrgUpgradeDialogComponent, {
      data: dialogConfig.data,
    });
  }
}
