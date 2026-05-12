import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
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
  map,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { ButtonModule, DialogModule, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { Cart, CartSummaryComponent } from "@bitwarden/pricing";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { SubscriberBillingClient } from "../../../clients/subscriber-billing.client";
import {
  EnterBillingAddressComponent,
  getBillingAddressFromForm,
  DisplayPaymentMethodInlineComponent,
  EnterPaymentMethodComponent,
} from "../../../payment/components";
import { MaskedPaymentMethod } from "../../../payment/types";
import { BitwardenSubscriber, mapAccountToSubscriber } from "../../../types";

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
    EnterBillingAddressComponent,
    DisplayPaymentMethodInlineComponent,
  ],
  templateUrl: "./premium-org-upgrade-payment.component.html",
})
export class PremiumOrgUpgradePaymentComponent implements OnInit, AfterViewInit {
  private readonly INITIAL_TAX_VALUE = 0;
  private readonly DEFAULT_SEAT_COUNT = 1;
  private readonly DEFAULT_CADENCE = "annually";
  private readonly PLAN_MEMBERSHIP_MESSAGES: Record<string, string> = {
    families: "familiesMembership",
    teams: "teamsMembership",
    enterprise: "enterpriseMembership",
  };
  private readonly UPGRADE_STATUS_MAP: Record<string, PremiumOrgUpgradePaymentStatus> = {
    families: PremiumOrgUpgradePaymentStatus.UpgradedToFamilies,
    teams: PremiumOrgUpgradePaymentStatus.UpgradedToTeams,
    enterprise: PremiumOrgUpgradePaymentStatus.UpgradedToEnterprise,
  };
  private readonly UPGRADE_MESSAGE_KEYS: Record<string, string> = {
    families: "upgradeToFamilies",
    teams: "upgradeToTeams",
    enterprise: "upgradeToEnterprise",
  };

  protected readonly selectedPlanId = input.required<
    PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId
  >();
  protected readonly account = input.required<Account>();

  protected readonly goBack = output<void>();
  protected readonly complete = output<PremiumOrgUpgradePaymentResult>();

  readonly cartSummaryComponent = viewChild.required<CartSummaryComponent>("cartSummaryComponent");
  readonly paymentMethodComponent =
    viewChild.required<DisplayPaymentMethodInlineComponent>("paymentMethodComponent");

  protected readonly formGroup = new FormGroup({
    organizationName: new FormControl<string>("", [Validators.required]),
    paymentMethodForm: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  protected readonly selectedPlan = signal<PremiumOrgUpgradePlanDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly upgradeToMessage = signal("");

  // Signals for payment method
  protected readonly paymentMethod = signal<MaskedPaymentMethod | null>(null);
  protected readonly subscriber = signal<BitwardenSubscriber | null>(null);

  protected readonly planMembershipMessage = computed<string>(
    () => this.PLAN_MEMBERSHIP_MESSAGES[this.selectedPlanId()] ?? "",
  );

  protected readonly showTaxIdField = computed<boolean>(() => {
    return this.selectedPlanId() !== PersonalSubscriptionPricingTierIds.Families;
  });

  // Use defer to lazily create the observable when subscribed to
  protected readonly estimatedInvoice$ = defer(() =>
    combineLatest([this.formGroup.controls.billingAddress.valueChanges]).pipe(
      startWith(this.formGroup.controls.billingAddress.value),
      debounceTime(1000),
      switchMap(() => this.refreshInvoicePreview$()),
    ),
  );

  protected readonly estimatedInvoice = toSignal(this.estimatedInvoice$, {
    initialValue: this.getEmptyInvoicePreview(),
  });

  private readonly i18nService = inject(I18nService);
  private readonly subscriptionPricingService = inject(SubscriptionPricingServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly premiumOrgUpgradeService = inject(PremiumOrgUpgradeService);
  private readonly subscriberBillingClient = inject(SubscriberBillingClient);
  private readonly accountService = inject(AccountService);

  constructor() {}
  // Cart Summary data
  protected readonly cart = computed<Cart>(() => {
    if (!this.selectedPlan()) {
      return {
        hidePricingTerm: true,
        passwordManager: {
          seats: {
            translationKey: this.planMembershipMessage(),
            cost: 0,
            quantity: 0,
            hideBreakdown: true,
          },
        },
        cadence: this.DEFAULT_CADENCE,
        estimatedTax: this.INITIAL_TAX_VALUE,
      };
    }

    return {
      hidePricingTerm: true,
      passwordManager: {
        seats: {
          translationKey: this.getMembershipTranslationKey(),
          translationParams: this.getMembershipTranslationParams(),
          cost: this.getCartCost(),
          quantity: this.DEFAULT_SEAT_COUNT,
          hideBreakdown: true,
        },
      },
      cadence: this.DEFAULT_CADENCE,
      estimatedTax: this.estimatedInvoice().tax,
      credit: {
        value: this.estimatedInvoice().credit,
        translationKey: "premiumSubscriptionCredit",
      },
    };
  });

  async ngOnInit(): Promise<void> {
    // If the selected plan is Personal Premium, no upgrade is needed
    if (this.selectedPlanId() == PersonalSubscriptionPricingTierIds.Premium) {
      this.complete.emit({
        status: PremiumOrgUpgradePaymentStatus.Closed,
        organizationId: null,
      });
      return;
    }

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
          this.setSelectedPlan(planDetails);
          this.setUpgradeMessage(planDetails);
        } else {
          this.complete.emit({
            status: PremiumOrgUpgradePaymentStatus.Closed,
            organizationId: null,
          });
          return;
        }
      });

    this.accountService.activeAccount$
      .pipe(
        mapAccountToSubscriber,
        switchMap((subscriber) =>
          from(this.subscriberBillingClient.getPaymentMethod(subscriber)).pipe(
            map((paymentMethod) => ({ subscriber, paymentMethod })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ subscriber, paymentMethod }) => {
        this.subscriber.set(subscriber);
        this.paymentMethod.set(paymentMethod);
        this.loading.set(false);
      });
  }

  ngAfterViewInit(): void {
    const cartSummaryComponent = this.cartSummaryComponent();
    cartSummaryComponent.isExpanded.set(false);
  }

  protected readonly submit = async (): Promise<void> => {
    if (!this.isFormValid()) {
      this.formGroup.markAllAsTouched();
      return;
    }

    const paymentMethodComponent = this.paymentMethodComponent();
    const isChangingPayment = paymentMethodComponent?.isChangingPayment();
    const paymentMethod = this.paymentMethod();

    if (
      !isChangingPayment &&
      this.premiumOrgUpgradeService.isUnverifiedBankAccount(paymentMethod)
    ) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unverifiedBankAccountNotSupportedForUpgrade"),
      });
      return;
    }

    if (!this.selectedPlan()) {
      throw new Error("No plan selected");
    }

    const organizationName = this.formGroup.value?.organizationName;
    if (!organizationName) {
      throw new Error("Organization name is required");
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    if (!billingAddress.country || !billingAddress.postalCode) {
      throw new Error("Billing address is incomplete");
    }

    if (isChangingPayment) {
      await this.updatePaymentMethod(billingAddress);
    } else {
      if (!paymentMethod) {
        throw new Error("Payment method is required");
      }
    }

    try {
      const result = await this.processUpgrade(organizationName, billingAddress);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("plansUpdated", this.selectedPlan()?.details.name),
      });
      this.complete.emit(result);
    } catch (error: unknown) {
      this.logService.error("Upgrade failed:", error);
      if (this.premiumOrgUpgradeService.isBankAccountNotSupportedError(error)) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("unverifiedBankAccountNotSupportedForUpgrade"),
        });
        return;
      }
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("upgradeErrorMessage"),
      });
    }
  };

  private async processUpgrade(
    organizationName: string,
    billingAddress: ReturnType<typeof getBillingAddressFromForm>,
  ): Promise<PremiumOrgUpgradePaymentResult> {
    const organizationId = await this.premiumOrgUpgradeService.upgradeToOrganization(
      this.account()!,
      organizationName,
      this.selectedPlan()!.tier,
      billingAddress,
    );

    return {
      status: this.getUpgradeStatus(this.selectedPlanId()),
      organizationId,
    };
  }

  private getUpgradeStatus(planId: string): PremiumOrgUpgradePaymentStatus {
    return this.UPGRADE_STATUS_MAP[planId] ?? PremiumOrgUpgradePaymentStatus.Closed;
  }

  /**
   * Updates the payment method with the new tokenized payment from the payment method component.
   */
  private async updatePaymentMethod(
    billingAddress: ReturnType<typeof getBillingAddressFromForm>,
  ): Promise<void> {
    const paymentMethodComponent = this.paymentMethodComponent();
    const newPaymentMethod = await paymentMethodComponent.getTokenizedPaymentMethod();
    await this.subscriberBillingClient.updatePaymentMethod(
      this.subscriber()!,
      newPaymentMethod,
      billingAddress,
    );
  }

  /**
   * Gets the appropriate translation key for the membership display.
   * Returns a prorated message if the plan has prorated months, otherwise returns the standard plan message.
   */
  private getMembershipTranslationKey(): string {
    return this.estimatedInvoice()?.newPlanProratedMonths > 0
      ? "planProratedMembershipInMonths"
      : this.planMembershipMessage();
  }

  /**
   * Gets the translation parameters for the membership display.
   * For prorated plans, returns an array with the plan name and formatted month duration.
   * For non-prorated plans, returns an empty array.
   */
  private getMembershipTranslationParams(): string[] {
    if (this.estimatedInvoice()?.newPlanProratedMonths > 0) {
      const months = this.estimatedInvoice()!.newPlanProratedMonths;
      const monthLabel = this.formatMonthLabel(months);
      return [this.selectedPlan()!.details.name, monthLabel];
    }
    return [];
  }

  /**
   * Formats month count into a readable string (e.g., "1 month", "3 months").
   */
  private formatMonthLabel(months: number): string {
    return `${months} month${months > 1 ? "s" : ""}`;
  }

  /**
   * Calculates the cart cost, using prorated amount if available, otherwise the plan cost.
   */
  private getCartCost(): number {
    const proratedAmount = this.estimatedInvoice().newPlanProratedAmount;
    return proratedAmount && proratedAmount > 0 ? proratedAmount : this.selectedPlan()!.cost;
  }

  /**
   * Sets the selected plan with tier, details, and cost.
   */
  private setSelectedPlan(
    planDetails: PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier,
  ): void {
    this.selectedPlan.set({
      tier: this.selectedPlanId(),
      details: planDetails,
      cost: this.getPlanPrice(planDetails),
    });
  }

  /**
   * Sets the upgrade message based on the selected plan.
   */
  private setUpgradeMessage(
    planDetails: PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier,
  ): void {
    const messageKey = this.UPGRADE_MESSAGE_KEYS[this.selectedPlanId()];
    const message = messageKey ? this.i18nService.t(messageKey, planDetails.name) : "";
    this.upgradeToMessage.set(message);
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
   * Returns an empty invoice preview with default values.
   */
  private getEmptyInvoicePreview(): InvoicePreview {
    return {
      tax: this.INITIAL_TAX_VALUE,
      total: 0,
      credit: 0,
      newPlanProratedMonths: 0,
      newPlanProratedAmount: 0,
    };
  }

  /**
   * Checks if the form is valid.
   */
  protected isFormValid(): boolean {
    const isParentFormValid =
      this.formGroup.controls.organizationName.valid &&
      this.formGroup.controls.billingAddress.valid;

    const paymentMethodComponent = this.paymentMethodComponent();
    const isChangingPayment = paymentMethodComponent?.isChangingPayment();
    if (paymentMethodComponent && isChangingPayment) {
      return isParentFormValid && paymentMethodComponent.isFormValid();
    }

    return isParentFormValid;
  }

  /**
   * Refreshes the invoice preview based on the current form state.
   */
  private refreshInvoicePreview$(): Observable<InvoicePreview> {
    if (!this.isFormValid()) {
      return of(this.getEmptyInvoicePreview());
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
    if (!billingAddress.country || !billingAddress.postalCode) {
      return of(this.getEmptyInvoicePreview());
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
        return of(this.getEmptyInvoicePreview());
      }),
    );
  }
}
