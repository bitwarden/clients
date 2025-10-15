import {
  AfterViewInit,
  Component,
  DestroyRef,
  input,
  OnInit,
  output,
  signal,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, Observable } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonModule, DialogModule, ToastService } from "@bitwarden/components";
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
export const UpgradePaymentStatus = {
  Back: "back",
  Closed: "closed",
  UpgradedToPremium: "upgradedToPremium",
  UpgradedToFamilies: "upgradedToFamilies",
} as const;

export type UpgradePaymentStatus = UnionOfValues<typeof UpgradePaymentStatus>;

export type UpgradePaymentResult = {
  status: UpgradePaymentStatus;
  organizationId: string | null;
};

/**
 * Parameters for upgrade payment
 */
export type UpgradePaymentParams = {
  plan: PersonalSubscriptionPricingTierId | null;
  subscriber: BitwardenSubscriber;
};

@Component({
  selector: "app-upgrade-payment",
  imports: [
    DialogModule,
    SharedModule,
    CartSummaryComponent,
    ButtonModule,
    EnterPaymentMethodComponent,
    BillingServicesModule,
  ],
  providers: [UpgradePaymentService],
  templateUrl: "./upgrade-payment.component.html",
})
export class UpgradePaymentComponent implements OnInit, AfterViewInit {
  protected selectedPlanId = input.required<PersonalSubscriptionPricingTierId>();
  protected account = input.required<Account>();
  protected goBack = output<void>();
  protected complete = output<UpgradePaymentResult>();
  protected selectedPlan: PlanDetails | null = null;

  @ViewChild(EnterPaymentMethodComponent) paymentComponent!: EnterPaymentMethodComponent;
  @ViewChild(CartSummaryComponent) cartSummaryComponent!: CartSummaryComponent;

  protected formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentForm: EnterPaymentMethodComponent.getFormGroup(),
  });

  protected loading = signal(true);
  private pricingTiers$!: Observable<PersonalSubscriptionPricingTier[]>;

  // Cart Summary data
  protected passwordManager!: LineItem;
  protected estimatedTax = 0;

  // Display data
  protected upgradeToMessage = "";

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingService,
    private toastService: ToastService,
    private logService: LogService,
    private destroyRef: DestroyRef,
    private upgradePaymentService: UpgradePaymentService,
  ) {}

  protected userIsOwnerOfFreeOrg$ = this.upgradePaymentService.userIsOwnerOfFreeOrg$;
  protected adminConsoleRouteForOwnedOrganization$ =
    this.upgradePaymentService.adminConsoleRouteForOwnedOrganization$;

  async ngOnInit(): Promise<void> {
    if (!this.isFamiliesPlan) {
      this.formGroup.controls.organizationName.disable();
    }

    this.pricingTiers$ = this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$();
    this.pricingTiers$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((plans) => {
      const planDetails = plans.find((plan) => plan.id === this.selectedPlanId());

      if (planDetails) {
        this.selectedPlan = {
          tier: this.selectedPlanId(),
          details: planDetails,
        };
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
      } else {
        this.complete.emit({ status: UpgradePaymentStatus.Closed, organizationId: null });
        return;
      }
    });

    this.formGroup.valueChanges
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshSalesTax());
    this.loading.set(false);
  }

  ngAfterViewInit(): void {
    if (this.cartSummaryComponent) {
      this.cartSummaryComponent.isExpanded.set(false);
    }
  }

  protected get isPremiumPlan(): boolean {
    return this.selectedPlanId() === PersonalSubscriptionPricingTierIds.Premium;
  }

  protected get isFamiliesPlan(): boolean {
    return this.selectedPlanId() === PersonalSubscriptionPricingTierIds.Families;
  }

  protected submit = async (): Promise<void> => {
    if (!this.isFormValid()) {
      this.formGroup.markAllAsTouched();
      return;
    }

    if (!this.selectedPlan) {
      throw new Error("No plan selected");
    }

    try {
      const result = await this.processUpgrade();
      if (result.status === UpgradePaymentStatus.UpgradedToFamilies) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("familiesUpdated"),
        });
      } else if (result.status === UpgradePaymentStatus.UpgradedToPremium) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("premiumUpdated"),
        });
      }
      this.complete.emit(result);
    } catch (error: unknown) {
      this.logService.error("Upgrade failed:", error);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("upgradeErrorMessage"),
      });
    }
  };

  protected isFormValid(): boolean {
    return this.formGroup.valid && this.paymentComponent?.validate();
  }

  private async processUpgrade(): Promise<UpgradePaymentResult> {
    // Get common values
    const country = this.formGroup.value?.paymentForm?.billingAddress?.country;
    const postalCode = this.formGroup.value?.paymentForm?.billingAddress?.postalCode;

    if (!this.selectedPlan) {
      throw new Error("No plan selected");
    }
    if (!country || !postalCode) {
      throw new Error("Billing address is incomplete");
    }

    // Validate organization name for Families plan
    const organizationName = this.formGroup.value?.organizationName;
    if (this.isFamiliesPlan && !organizationName) {
      throw new Error("Organization name is required");
    }

    // Get payment method
    const tokenizedPaymentMethod = await this.paymentComponent?.tokenize();

    if (!tokenizedPaymentMethod) {
      throw new Error("Payment method is required");
    }

    // Process the upgrade based on plan type
    if (this.isFamiliesPlan) {
      const paymentFormValues = {
        organizationName,
        billingAddress: { country, postalCode },
      };

      const response = await this.upgradePaymentService.upgradeToFamilies(
        this.account(),
        this.selectedPlan,
        tokenizedPaymentMethod,
        paymentFormValues,
      );

      return { status: UpgradePaymentStatus.UpgradedToFamilies, organizationId: response.id };
    } else {
      await this.upgradePaymentService.upgradeToPremium(tokenizedPaymentMethod, {
        country,
        postalCode,
      });
      return { status: UpgradePaymentStatus.UpgradedToPremium, organizationId: null };
    }
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
        line1: null,
        line2: null,
        city: null,
        state: null,
        country: billingAddress.country,
        postalCode: billingAddress.postalCode,
        taxId: null,
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
