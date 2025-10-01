import { DialogConfig } from "@angular/cdk/dialog";
import { Component, DestroyRef, Inject, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, Observable } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { CartSummaryComponent, LineItem } from "@bitwarden/pricing";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { EnterPaymentMethodComponent } from "../../../payment/components";
import { BillingServicesModule } from "../../../services";
import { SubscriptionPricingService } from "../../../services/subscription-pricing.service";
import { BitwardenSubscriber } from "../../../types";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "../../../types/subscription-pricing-tier";

import { PlanDetails, UpgradePaymentService } from "./services/upgrade-payment.service";

/**
 * Status types for upgrade payment dialog
 */
export const UpgradePaymentDialogResult = {
  Back: "back",
  UpgradedToPremium: "upgradedToPremium",
  UpgradedToFamilies: "upgradedToFamilies",
} as const;

export type UpgradePaymentDialogResult = UnionOfValues<typeof UpgradePaymentDialogResult>;

/**
 * Parameters for upgrade payment dialog
 */
export type UpgradePaymentDialogParams = {
  plan: PersonalSubscriptionPricingTierId | null;
  subscriber: BitwardenSubscriber;
};

@Component({
  selector: "app-upgrade-payment-dialog",
  imports: [
    DialogModule,
    SharedModule,
    CartSummaryComponent,
    ButtonModule,
    EnterPaymentMethodComponent,
    BillingServicesModule,
  ],
  providers: [UpgradePaymentService],
  templateUrl: "./upgrade-payment-dialog.component.html",
})
export class UpgradePaymentDialogComponent implements OnInit {
  @ViewChild(EnterPaymentMethodComponent) paymentComponent!: EnterPaymentMethodComponent;

  protected formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentForm: EnterPaymentMethodComponent.getFormGroup(),
  });

  protected loading = true;
  private pricingTiers$!: Observable<PersonalSubscriptionPricingTier[]>;
  protected selectedPlan!: PlanDetails;

  // Cart Summary data
  protected passwordManager!: LineItem;
  protected estimatedTax = 0;

  // Display data
  protected upgradeToMessage = "";

  constructor(
    private dialogRef: DialogRef<UpgradePaymentDialogResult>,
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingService,
    private toastService: ToastService,
    private logService: LogService,
    private destroyRef: DestroyRef,
    private upgradePaymentService: UpgradePaymentService,
    @Inject(DIALOG_DATA) private dialogParams: UpgradePaymentDialogParams,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.isFamiliesPlan) {
      this.formGroup.controls.organizationName.disable();
    }

    this.pricingTiers$ = this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$();
    this.pricingTiers$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((plans) => {
      const planDetails = plans.find((plan) => plan.id === this.dialogParams.plan);

      if (planDetails && this.dialogParams.plan) {
        this.selectedPlan = {
          tier: this.dialogParams.plan,
          details: planDetails,
        };
      }
    });

    if (!this.selectedPlan) {
      this.close(UpgradePaymentDialogResult.Back);
      return;
    }

    this.passwordManager = {
      name: this.isFamiliesPlan ? "familiesMembership" : "premiumMembership",
      cost: this.selectedPlan.details.passwordManager.annualPrice,
      quantity: 1,
      cadence: "year",
    };

    this.upgradeToMessage = this.i18nService.t(
      this.isFamiliesPlan ? "upgradeToFamilies" : "upgradeToPremium",
    );

    this.estimatedTax = 0;

    this.formGroup.valueChanges
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshSalesTax());

    this.loading = false;
  }

  protected get isPremiumPlan(): boolean {
    return this.dialogParams.plan === PersonalSubscriptionPricingTierIds.Premium;
  }

  protected get isFamiliesPlan(): boolean {
    return this.dialogParams.plan === PersonalSubscriptionPricingTierIds.Families;
  }

  back = () => {
    this.close(UpgradePaymentDialogResult.Back);
  };

  static open(
    dialogService: DialogService,
    dialogConfig: DialogConfig<UpgradePaymentDialogParams>,
  ): DialogRef<UpgradePaymentDialogResult> {
    return dialogService.open<UpgradePaymentDialogResult>(
      UpgradePaymentDialogComponent,
      dialogConfig,
    );
  }

  protected submit = async (): Promise<void> => {
    if (!this.isFormValid()) {
      this.formGroup.markAllAsTouched();
      return;
    }

    if (!this.selectedPlan) {
      throw new Error("No plan selected");
    }

    if (!this.formGroup.value.paymentForm?.billingAddress) {
      throw new Error("No billing address provided");
    }

    try {
      await (this.isFamiliesPlan ? this.processFamiliesUpgrade() : this.processPremiumUpgrade());
    } catch (error: unknown) {
      this.logService.error("Upgrade failed:", error);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("upgradeError"),
      });
    }
  };

  private isFormValid(): boolean {
    return this.formGroup.valid && this.paymentComponent?.validate();
  }

  private async processFamiliesUpgrade(): Promise<void> {
    const organizationName = this.formGroup.value?.organizationName;
    const country = this.formGroup.value?.paymentForm?.billingAddress?.country;
    const postalCode = this.formGroup.value?.paymentForm?.billingAddress?.postalCode;

    if (!organizationName) {
      throw new Error("Organization name is required");
    }

    if (!country || !postalCode) {
      throw new Error("Billing address is incomplete");
    }

    const tokenizedPaymentMethod = await this.paymentComponent.tokenize();
    if (!tokenizedPaymentMethod) {
      throw new Error("Payment information is incomplete");
    }

    const paymentFormValues = {
      organizationName,
      billingAddress: {
        country,
        postalCode,
      },
    };

    await this.upgradePaymentService.upgradeToFamilies(
      this.dialogParams.subscriber,
      this.selectedPlan,
      tokenizedPaymentMethod,
      paymentFormValues,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("familiesUpdated"),
    });

    this.close(UpgradePaymentDialogResult.UpgradedToFamilies);
  }

  private async processPremiumUpgrade(): Promise<void> {
    const tokenizedPaymentMethod = await this.paymentComponent.tokenize();
    if (!tokenizedPaymentMethod) {
      throw new Error("Payment information is incomplete");
    }
    const country = this.formGroup.value?.paymentForm?.billingAddress?.country;
    const postalCode = this.formGroup.value?.paymentForm?.billingAddress?.postalCode;

    if (!country || !postalCode) {
      throw new Error("Billing address is incomplete");
    }

    await this.upgradePaymentService.upgradeToPremium(
      this.dialogParams.subscriber,
      tokenizedPaymentMethod,
      {
        country,
        postalCode,
      },
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("premiumUpdated"),
    });

    this.close(UpgradePaymentDialogResult.UpgradedToPremium);
  }

  private close(result: UpgradePaymentDialogResult) {
    this.dialogRef.close(result);
  }

  private async refreshSalesTax(): Promise<void> {
    const billingAddress = {
      country: this.formGroup.value.paymentForm?.billingAddress?.country,
      postalCode: this.formGroup.value.paymentForm?.billingAddress?.postalCode,
    };

    if (!this.selectedPlan || !billingAddress.country || !billingAddress.postalCode) {
      this.estimatedTax = 0;
      return;
    }

    this.upgradePaymentService
      .calculateEstimatedTax(this.selectedPlan, {
        country: billingAddress.country,
        postalCode: billingAddress.postalCode,
      })
      .then((tax) => {
        this.estimatedTax = tax;
      })
      .catch((error: unknown) => {
        this.logService.error("Tax calculation failed:", error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("taxCalculationError"),
        });
        this.estimatedTax = 0;
      });
  }
}
