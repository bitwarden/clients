import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  catchError,
  of,
  combineLatest,
  startWith,
  debounceTime,
  switchMap,
  Observable,
  from,
  defer,
} from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonModule, DialogModule, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { Cart, CartSummaryComponent } from "@bitwarden/pricing";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "../../../payment/components";

import {
  PremiumOrgUpgradeService,
  PremiumOrgUpgradePlanDetails,
  InvoicePreview,
} from "./services/premium-org-upgrade.service";

export const PremiumOrgUpgradePaymentStatus = {
  Closed: "closed",
  UpgradedToTeams: "upgradedToTeams",
  UpgradedToEnterprise: "upgradedToEnterprise",
  UpgradedToFamilies: "upgradedToFamilies",
} as const;

export type PremiumOrgUpgradePaymentStatus = UnionOfValues<typeof PremiumOrgUpgradePaymentStatus>;

export type PremiumOrgUpgradePaymentResult = {
  status: PremiumOrgUpgradePaymentStatus;
  organizationId?: string | null;
};

@Component({
  selector: "app-premium-org-upgrade-payment",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    SharedModule,
    CartSummaryComponent,
    ButtonModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
  ],
  providers: [PremiumOrgUpgradeService],
  templateUrl: "./premium-org-upgrade-payment.component.html",
})
export class PremiumOrgUpgradePaymentComponent implements OnInit, AfterViewInit {
  private readonly INITIAL_TAX_VALUE = 0;
  private readonly DEFAULT_SEAT_COUNT = 1;
  private readonly DEFAULT_CADENCE = "annually";

  protected readonly selectedPlanId = input.required<
    PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId
  >();
  protected readonly account = input.required<Account>();
  protected goBack = output<void>();
  protected complete = output<PremiumOrgUpgradePaymentResult>();

  readonly paymentComponent = viewChild.required(EnterPaymentMethodComponent);
  readonly cartSummaryComponent = viewChild.required(CartSummaryComponent);

  protected formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentForm: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  protected readonly selectedPlan = signal<PremiumOrgUpgradePlanDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly upgradeToMessage = signal("");

  // Use defer to lazily create the observable when subscribed to
  protected estimatedInvoice$ = defer(() =>
    this.formGroup.controls.billingAddress.valueChanges.pipe(
      startWith(this.formGroup.controls.billingAddress.value),
      debounceTime(1000),
      switchMap(() => this.refreshInvoicePreview$()),
    ),
  );

  protected readonly estimatedInvoice = toSignal(this.estimatedInvoice$, {
    initialValue: { tax: this.INITIAL_TAX_VALUE, total: 0, credit: 0 },
  });

  // Cart Summary data
  protected readonly cart = computed<Cart>(() => {
    if (!this.selectedPlan()) {
      return {
        passwordManager: {
          seats: { translationKey: "", cost: 0, quantity: 0 },
        },
        cadence: this.DEFAULT_CADENCE,
        estimatedTax: this.INITIAL_TAX_VALUE,
      };
    }

    return {
      passwordManager: {
        seats: {
          translationKey: this.selectedPlan()?.details.name ?? "",
          cost: this.selectedPlan()?.cost ?? 0,
          quantity: this.DEFAULT_SEAT_COUNT,
        },
      },
      cadence: this.DEFAULT_CADENCE,
      estimatedTax: this.estimatedInvoice().tax,
      discount: { type: "amount-off", value: this.estimatedInvoice().credit },
    };
  });

  constructor(
    private i18nService: I18nService,
    private subscriptionPricingService: SubscriptionPricingServiceAbstraction,
    private toastService: ToastService,
    private logService: LogService,
    private destroyRef: DestroyRef,
    private premiumOrgUpgradeService: PremiumOrgUpgradeService,
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
            title: this.i18nService.t("error"),
            message: this.i18nService.t("unexpectedError"),
          });
          this.loading.set(false);
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([personalPlans, businessPlans]) => {
        const plans: (PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier)[] = [
          ...personalPlans,
          ...businessPlans,
        ];
        const planDetails = plans.find((plan) => plan.id === this.selectedPlanId());

        if (planDetails) {
          this.selectedPlan.set({
            tier: this.selectedPlanId(),
            details: planDetails,
            cost: this.getPlanPrice(planDetails),
          });

          this.upgradeToMessage.set(this.i18nService.t("startFreeTrial", planDetails.name));
        } else {
          this.complete.emit({
            status: PremiumOrgUpgradePaymentStatus.Closed,
            organizationId: null,
          });
          return;
        }
      });

    this.loading.set(false);
  }

  ngAfterViewInit(): void {
    const cartSummaryComponent = this.cartSummaryComponent();
    cartSummaryComponent.isExpanded.set(false);
  }

  protected submit = async (): Promise<void> => {
    if (!this.isFormValid()) {
      this.formGroup.markAllAsTouched();
      return;
    }

    if (!this.selectedPlan()) {
      throw new Error("No plan selected");
    }

    try {
      const result = await this.processUpgrade();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("organizationUpdated", this.selectedPlan()?.details.name),
      });
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

  private async processUpgrade(): Promise<PremiumOrgUpgradePaymentResult> {
    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    const organizationName = this.formGroup.value?.organizationName;

    if (!billingAddress.country || !billingAddress.postalCode) {
      throw new Error("Billing address is incomplete");
    }

    if (!organizationName) {
      throw new Error("Organization name is required");
    }

    const paymentMethod = await this.paymentComponent().tokenize();

    if (!paymentMethod) {
      throw new Error("Payment method is required");
    }

    await this.premiumOrgUpgradeService.upgradeToOrganization(
      this.account(),
      organizationName,
      this.selectedPlan()!,
      billingAddress,
    );

    return {
      status: this.getUpgradeStatus(this.selectedPlanId()),
      organizationId: null,
    };
  }

  private getUpgradeStatus(planId: string): PremiumOrgUpgradePaymentStatus {
    switch (planId) {
      case "families":
        return PremiumOrgUpgradePaymentStatus.UpgradedToFamilies;
      case "teams":
        return PremiumOrgUpgradePaymentStatus.UpgradedToTeams;
      case "enterprise":
        return PremiumOrgUpgradePaymentStatus.UpgradedToEnterprise;
      default:
        return PremiumOrgUpgradePaymentStatus.Closed;
    }
  }

  /**
   * Calculates the price for the currently selected plan.
   *
   * This method retrieves the `passwordManager` details from the selected plan. It then determines
   * the appropriate price based on the properties available on the `passwordManager` object.
   * It prioritizes `annualPrice` for individual-style plans and falls back to `annualPricePerUser`
   * for user-based plans.
   *
   * @returns The annual price of the plan as a number. Returns `0` if the plan or its price cannot be determined.
   */
  private getPlanPrice(
    plan: PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier,
  ): number {
    const passwordManager = plan.passwordManager;
    if (!passwordManager) {
      return 0;
    }

    if ("annualPrice" in passwordManager) {
      return passwordManager.annualPrice ?? 0;
    } else if ("annualPricePerUser" in passwordManager) {
      return passwordManager.annualPricePerUser ?? 0;
    }
    return 0;
  }

  /**
   * Refreshes the invoice preview based on the current form state.
   */
  private refreshInvoicePreview$(): Observable<InvoicePreview> {
    if (this.formGroup.invalid || !this.selectedPlan()) {
      return of({ tax: this.INITIAL_TAX_VALUE, total: 0, credit: 0 });
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    if (!billingAddress.country || !billingAddress.postalCode) {
      return of({ tax: this.INITIAL_TAX_VALUE, total: 0, credit: 0 });
    }
    return from(
      this.premiumOrgUpgradeService.previewProratedInvoice(this.selectedPlan()!, billingAddress),
    ).pipe(
      catchError((error: unknown) => {
        this.logService.error("Invoice preview failed:", error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("invoicePreviewErrorMessage"),
        });
        return of({ tax: this.INITIAL_TAX_VALUE, total: 0, credit: 0 });
      }),
    );
  }
}
