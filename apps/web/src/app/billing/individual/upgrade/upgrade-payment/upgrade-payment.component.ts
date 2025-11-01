import {
  AfterViewInit,
  Component,
  DestroyRef,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  debounceTime,
  Observable,
  switchMap,
  startWith,
  from,
  catchError,
  of,
  combineLatest,
  map,
  shareReplay,
} from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonModule, DialogModule, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { CartSummaryComponent, LineItem } from "@bitwarden/pricing";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "../../../payment/components";
import {
  BillingAddress,
  NonTokenizablePaymentMethods,
  NonTokenizedPaymentMethod,
  TokenizedPaymentMethod,
} from "../../../payment/types";
import { BillingServicesModule } from "../../../services";
import { BitwardenSubscriber } from "../../../types";

import {
  PaymentFormValues,
  PlanDetails,
  UpgradePaymentService,
} from "./services/upgrade-payment.service";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-upgrade-payment",
  imports: [
    DialogModule,
    SharedModule,
    CartSummaryComponent,
    ButtonModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    BillingServicesModule,
  ],
  providers: [UpgradePaymentService],
  templateUrl: "./upgrade-payment.component.html",
})
export class UpgradePaymentComponent implements OnInit, AfterViewInit {
  private readonly INITIAL_TAX_VALUE = 0;
  protected readonly selectedPlanId = input.required<PersonalSubscriptionPricingTierId>();
  protected readonly account = input.required<Account>();
  protected goBack = output<void>();
  protected complete = output<UpgradePaymentResult>();
  protected selectedPlan: PlanDetails | null = null;
  protected hasEnoughAccountCredit$!: Observable<boolean>;

  readonly paymentComponent = viewChild.required(EnterPaymentMethodComponent);
  readonly cartSummaryComponent = viewChild.required(CartSummaryComponent);

  protected formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentForm: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  protected readonly loading = signal(true);
  private pricingTiers$!: Observable<PersonalSubscriptionPricingTier[]>;

  // Cart Summary data
  protected passwordManager!: LineItem;
  protected estimatedTax$!: Observable<number>;

  // Display data
  protected upgradeToMessage = "";

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingServiceAbstraction,
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
    this.pricingTiers$
      .pipe(
        catchError((error: unknown) => {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("error"),
            message: this.i18nService.t("unexpectedError"),
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((plans) => {
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
            this.isFamiliesPlan ? "startFreeFamiliesTrial" : "upgradeToPremium",
          );
        } else {
          this.complete.emit({ status: UpgradePaymentStatus.Closed, organizationId: null });
          return;
        }
      });

    this.estimatedTax$ = this.formGroup.controls.billingAddress.valueChanges.pipe(
      startWith(this.formGroup.controls.billingAddress.value),
      debounceTime(1000),
      // Only proceed when form has required values
      switchMap(() => this.refreshSalesTax$()),
    );

    this.loading.set(false);
  }

  ngAfterViewInit(): void {
    const cartSummaryComponent = this.cartSummaryComponent();
    cartSummaryComponent.isExpanded.set(false);

    this.hasEnoughAccountCredit$ = combineLatest([
      cartSummaryComponent.total$,
      this.upgradePaymentService.accountCredit$,
      this.formGroup.controls.paymentForm.valueChanges.pipe(
        startWith(this.formGroup.controls.paymentForm.value),
      ),
    ]).pipe(
      map(([total, credit, currentFormValue]) => {
        const selectedPaymentType = currentFormValue?.type;
        if (selectedPaymentType !== NonTokenizablePaymentMethods.accountCredit) {
          return true; // Not using account credit, so this check doesn't apply
        }
        return credit ? credit >= total : false;
      }),
      shareReplay({ bufferSize: 1, refCount: true }), // Cache the latest for two async pipes
    );
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
    return this.formGroup.valid && this.paymentComponent().validate();
  }

  private async processUpgrade(): Promise<UpgradePaymentResult> {
    if (!this.selectedPlan) {
      throw new Error("No plan selected");
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    const organizationName = this.formGroup.value?.organizationName;

    if (!billingAddress.country || !billingAddress.postalCode) {
      throw new Error("Billing address is incomplete");
    }

    if (this.isFamiliesPlan && !organizationName) {
      throw new Error("Organization name is required");
    }

    const paymentMethod = await this.getPaymentMethod();

    if (!paymentMethod) {
      throw new Error("Payment method is required");
    }

    const isTokenizedPayment = "token" in paymentMethod;

    if (!isTokenizedPayment && this.isFamiliesPlan) {
      throw new Error("Tokenized payment is required for families plan");
    }

    return this.isFamiliesPlan
      ? this.processFamiliesUpgrade(
          organizationName!,
          billingAddress,
          paymentMethod as TokenizedPaymentMethod,
        )
      : this.processPremiumUpgrade(paymentMethod, billingAddress);
  }

  private async processFamiliesUpgrade(
    organizationName: string,
    billingAddress: BillingAddress,
    paymentMethod: TokenizedPaymentMethod,
  ): Promise<UpgradePaymentResult> {
    const paymentFormValues: PaymentFormValues = {
      organizationName,
      billingAddress,
    };

    const response = await this.upgradePaymentService.upgradeToFamilies(
      this.account(),
      this.selectedPlan!,
      paymentMethod,
      paymentFormValues,
    );

    return { status: UpgradePaymentStatus.UpgradedToFamilies, organizationId: response.id };
  }

  private async processPremiumUpgrade(
    paymentMethod: NonTokenizedPaymentMethod | TokenizedPaymentMethod,
    billingAddress: BillingAddress,
  ): Promise<UpgradePaymentResult> {
    await this.upgradePaymentService.upgradeToPremium(paymentMethod, billingAddress);
    return { status: UpgradePaymentStatus.UpgradedToPremium, organizationId: null };
  }

  /**
   * Get payment method based on selected type
   * If using account credit, returns a non-tokenized payment method
   * Otherwise, tokenizes the payment method from the payment component
   */
  private async getPaymentMethod(): Promise<
    NonTokenizedPaymentMethod | TokenizedPaymentMethod | null
  > {
    const isAccountCreditSelected =
      this.formGroup.value?.paymentForm?.type === NonTokenizablePaymentMethods.accountCredit;

    if (isAccountCreditSelected) {
      return { type: NonTokenizablePaymentMethods.accountCredit };
    }

    return await this.paymentComponent().tokenize();
  }

  // Create an observable for tax calculation
  private refreshSalesTax$(): Observable<number> {
    if (this.formGroup.invalid || !this.selectedPlan) {
      return of(this.INITIAL_TAX_VALUE);
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    if (!billingAddress.country || !billingAddress.postalCode) {
      return of(this.INITIAL_TAX_VALUE);
    }
    return from(
      this.upgradePaymentService.calculateEstimatedTax(this.selectedPlan, billingAddress),
    ).pipe(
      catchError((error: unknown) => {
        this.logService.error("Tax calculation failed:", error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("taxCalculationError"),
        });
        return of(this.INITIAL_TAX_VALUE); // Return default value on error
      }),
    );
  }
}
