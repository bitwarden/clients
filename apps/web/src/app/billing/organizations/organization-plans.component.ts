import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  OnDestroy,
  OnInit,
  output,
  resource,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { catchError, firstValueFrom, merge, of, Subject, takeUntil } from "rxjs";
import { debounceTime, filter, switchMap } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { singleOrganizationPolicyApplies$ } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import {
  InitiationPath,
  PlanSponsorshipType,
  PlanType,
  ProductTierType,
} from "@bitwarden/common/billing/enums";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { IconComponent, ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { Cart, CartSummaryComponent, Discount, DiscountTypes } from "@bitwarden/pricing";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { DEFAULT_TRIAL_LENGTH_DAYS } from "@bitwarden/web-vault/app/billing/constants";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { tokenizablePaymentMethodToLegacyEnum } from "@bitwarden/web-vault/app/billing/payment/types";
import {
  OrganizationSubscriptionPlan,
  OrganizationSubscriptionPurchase,
} from "@bitwarden/web-vault/app/billing/types";

import { OrganizationInformationComponent } from "../../admin-console/organizations/create/organization-information.component";
import { PremiumOrgUpgradeService } from "../individual/upgrade/premium-org-upgrade-payment/services/premium-org-upgrade.service";
import { InvoicePreviewService } from "../services/invoice-preview.service";
import { SubscriptionDiscountService } from "../services/subscription-discount.service";
import { BillingSharedModule, secretsManagerSubscribeFormFactory } from "../shared";
import { invoicePreviewErrorMessageKey } from "../shared/invoice-preview-error-message-key";

interface OnSuccessArgs {
  organizationId: string;
}
interface OnTrialBillingSuccessArgs {
  orgId: string;
  subLabelText: string;
}

type PreviewParams =
  | {
      kind: "premiumUpgrade";
      request: Parameters<InvoicePreviewService["previewPremiumOrgUpgradeCart"]>[0];
      planName: string;
    }
  | {
      kind: "checkout";
      request: Parameters<InvoicePreviewService["previewOrganizationCheckoutCart"]>[0];
    };

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-plans",
  templateUrl: "organization-plans.component.html",
  imports: [
    BillingSharedModule,
    OrganizationInformationComponent,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    IconComponent,
    CartSummaryComponent,
    Vfo1I18nPipe,
  ],
})
export class OrganizationPlansComponent implements OnInit, OnDestroy {
  // ViewChildren
  readonly enterPaymentMethodComponent = viewChild(EnterPaymentMethodComponent);

  // Inputs
  readonly acceptingSponsorship = input<boolean>(false);
  readonly planSponsorshipType = input<PlanSponsorshipType | null>(null);
  readonly enableSecretsManagerByDefault = input<boolean>(false);

  /**
   * Initial product tier for form initialization only.
   * After initialization, the form control becomes the source of truth.
   */
  readonly initialProductTier = input<ProductTierType>(ProductTierType.Free);

  /**
   * Initial plan for form initialization only.
   * After initialization, the form control becomes the source of truth.
   */
  readonly initialPlan = input<PlanType>(PlanType.Free);

  /** Custom trial length from the URL, overrides the plan's default trialPeriodDays for display and API calls. */
  readonly trialLength = input<number | undefined>(undefined);

  /** Marketing-vs-product origin recorded on the create request; drives Stripe's trialInitiationPath metadata. */
  readonly initiationPath = input<InitiationPath>(InitiationPath.NewOrganizationCreationInProduct);

  // Derived signals
  readonly hasPremiumPersonally = toSignal(
    this.accountService.activeAccount$.pipe(
      filter(Boolean),
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumPersonally$(account.id),
      ),
    ),
    { initialValue: false },
  );
  readonly premiumToOrganizationUpgradeFeatureFlagEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM29593_PremiumToOrganizationUpgrade),
    { initialValue: false },
  );

  // Computed signals
  private readonly vfo1Enabled = inject(Vfo1TerminologyService).enabled;

  /**
   * Tightens the spacing between sections to 24px, replacing the default `bit-section` margin.
   * Only applies when the component is hosted in the sponsorship flow with VFO1 on.
   */
  protected readonly sponsoredPlanLayout = computed(
    () => this.acceptingSponsorship() && this.vfo1Enabled(),
  );

  /**
   * Determines whether the user can upgrade from Premium to an organization plan.
   * This is true if the user has a Premium subscription personally and is not accepting a sponsorship.
   * Also checks that the relevant feature flag is enabled
   */
  readonly canUpgradeFromPremium = computed<boolean>(() => {
    const hasPremiumPersonally = this.hasPremiumPersonally();
    const premiumToOrganizationUpgradeFeatureFlagEnabled =
      this.premiumToOrganizationUpgradeFeatureFlagEnabled();
    return (
      hasPremiumPersonally &&
      premiumToOrganizationUpgradeFeatureFlagEnabled &&
      !this.acceptingSponsorship()
    );
  });

  readonly selectedPlan = computed(() =>
    this.passwordManagerPlans.find((plan) => plan.type === this.formValues().plan),
  );

  readonly selectedSecretsManagerPlan = computed(() =>
    this.secretsManagerPlans.find((plan) => plan.type === this.formValues().plan),
  );

  readonly selectedPlanInterval = computed(() =>
    this.selectedPlan()?.isAnnual ? "year" : "month",
  );

  readonly freeTrial = computed(
    () => (this.trialLength() ?? this.selectedPlan()?.trialPeriodDays ?? 0) > 0,
  );

  readonly planOffersSecretsManager = computed(() => this.selectedSecretsManagerPlan() != null);

  readonly selectableProducts = computed(() => {
    if (this.acceptingSponsorship()) {
      const familyPlan = this.passwordManagerPlans.find((plan) => plan.type === this._familyPlan);
      return [familyPlan];
    }

    const businessOwnedIsChecked = this.formValues().businessOwned;
    const result = this.passwordManagerPlans.filter((plan) => {
      const isNotCustomPlan = plan.type !== PlanType.Custom;
      const isBusinessCompatible = !businessOwnedIsChecked || plan.canBeUsedByBusiness;
      const isAnnualOrOtherEligibleCase =
        plan.isAnnual ||
        plan.productTier === ProductTierType.Free ||
        plan.productTier === ProductTierType.TeamsStarter;
      const isCorrectFamilyPlanVariant =
        plan.productTier !== ProductTierType.Families || plan.type === this._familyPlan;
      const isPlanEnabled = this.planIsEnabled(plan);

      return (
        isNotCustomPlan &&
        isBusinessCompatible &&
        isAnnualOrOtherEligibleCase &&
        isCorrectFamilyPlanVariant &&
        isPlanEnabled
      );
    });

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  });

  readonly selectablePlans = computed(() => {
    const selectedProductTierType = this.formValues().productTier;
    const result =
      this.passwordManagerPlans?.filter((plan) => {
        const matchesSelectedTier = plan.productTier === selectedProductTierType;
        const isCorrectFamilyPlan =
          plan.productTier !== ProductTierType.Families || plan.type === this._familyPlan;

        return matchesSelectedTier && isCorrectFamilyPlan && this.planIsEnabled(plan);
      }) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);
    return result;
  });

  readonly teamsStarterPlanIsAvailable = computed(() =>
    this.selectablePlans().some((plan) => plan.type === PlanType.TeamsStarter),
  );

  private readonly eligibleDiscounts$ = this.subscriptionDiscountService
    .getEligibleDiscountsForTier$(DiscountTierType.Families)
    .pipe(catchError(() => of([])));

  readonly eligibleDiscounts = toSignal(this.eligibleDiscounts$, { initialValue: [] });

  readonly cartDiscounts = computed<Discount[] | undefined>(() =>
    !this.acceptingSponsorship() && this.formValues().productTier === ProductTierType.Families
      ? this.eligibleDiscounts()
          .map((discount) => this.subscriptionDiscountService.mapToCartDiscount(discount))
          .filter((discount) => !!discount)
      : undefined,
  );

  private readonly eligibleCouponIds = computed<string[]>(() =>
    !this.acceptingSponsorship() && this.formValues().productTier === ProductTierType.Families
      ? this.eligibleDiscounts().map((d: SubscriptionDiscount) => d.stripeCouponId)
      : [],
  );

  protected readonly showTaxIdField = computed<boolean>(() => {
    switch (this.formValues().productTier) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return false;
      default:
        return true;
    }
  });

  // Outputs
  readonly onSuccess = output<OnSuccessArgs>();
  readonly onTrialBillingSuccess = output<OnTrialBillingSuccessArgs>();

  // State properties
  protected loading = true;
  protected selfHosted = false;
  protected readonly productTypes = ProductTierType;
  protected formPromise: Promise<string> | null = null;
  protected singleOrgPolicyAppliesToActiveUser = false;
  protected isInTrialFlow = false;

  /**
   * Sponsorship discount applied when a user is accepting a Families plan sponsorship.
   * This is unrelated to the eligible discount system introduced via {@link SubscriptionDiscountService},
   * which handles coupon-based discounts fetched from the billing API.
   */
  protected get familiesSponsorshipDiscount(): number {
    if (!this.acceptingSponsorship()) {
      return 0;
    }
    const familyPlan = this.passwordManagerPlans.find((plan) => plan.type === this._familyPlan);
    return familyPlan?.PasswordManager.basePrice ?? 0;
  }

  // Plan data
  protected passwordManagerPlans: PlanResponse[] = [];
  protected secretsManagerPlans: PlanResponse[] = [];

  // Cart for CartSummary component. The server preview wins; until one returns (or when none is
  // requested, e.g. invalid address, Free, Teams Starter) the cart is priced from form state with
  // no tax.
  protected readonly cart = computed<Cart>(() => this.displayedPreview() ?? this.formStateCart());

  private formStateCart(): Cart {
    const formValues = this.formValues();
    const plan = this.selectedPlan();

    if (!plan) {
      return {
        passwordManager: {
          seats: { translationKey: "passwordManager", cost: 0, quantity: 1, hideBreakdown: true },
        },
        cadence: "annually",
        estimatedTax: 0,
      };
    }

    const cadence = plan.isAnnual ? "annually" : "monthly";
    const hasAdditionalSeats =
      plan.PasswordManager.hasAdditionalSeatsOption && formValues.additionalSeats;
    const pmBaseCost = hasAdditionalSeats
      ? plan.PasswordManager.seatPrice
      : plan.PasswordManager.basePrice;
    const totalSeats = hasAdditionalSeats ? (formValues.additionalSeats ?? 0) : 1;

    if (this.canUpgradeFromPremium()) {
      return {
        passwordManager: {
          seats: {
            translationKey: "passwordManagerPlanPrice",
            cost: pmBaseCost,
            quantity: totalSeats,
            hideBreakdown: true,
          },
        },
        cadence,
        estimatedTax: 0,
      };
    }

    let adjustedPmBaseCost = pmBaseCost;
    if (plan.PasswordManager.hasPremiumAccessOption && formValues.premiumAccessAddon) {
      adjustedPmBaseCost += plan.PasswordManager.premiumAccessOptionPrice;
    }
    const cart: Cart = {
      passwordManager: {
        seats: {
          translationKey: "passwordManagerPlanPrice",
          cost: adjustedPmBaseCost,
          quantity: totalSeats,
        },
      },
      cadence,
      estimatedTax: 0,
    };

    if (this.acceptingSponsorship() && this.familiesSponsorshipDiscount > 0) {
      cart.discounts = [{ type: DiscountTypes.AmountOff, value: this.familiesSponsorshipDiscount }];
    } else {
      cart.discounts = this.cartDiscounts();
    }

    if (
      plan.PasswordManager.hasAdditionalStorageOption &&
      (formValues.additionalStorage ?? 0) > 0
    ) {
      cart.passwordManager.additionalStorage = {
        translationKey: "additionalStorageGb",
        cost: plan.PasswordManager.additionalStoragePricePerGb,
        quantity: formValues.additionalStorage ?? 0,
      };
    }

    if (this.planOffersSecretsManager() && formValues.secretsManager?.enabled) {
      const smPlan = this.selectedSecretsManagerPlan()!;
      let totalSmSeats = smPlan.SecretsManager.baseSeats;
      if (
        smPlan.SecretsManager.hasAdditionalSeatsOption &&
        (formValues.secretsManager?.userSeats ?? 0) > 0
      ) {
        totalSmSeats += formValues.secretsManager?.userSeats ?? 0;
      }

      cart.secretsManager = {
        seats: {
          translationKey: "secretsManagerPlanPrice",
          cost: smPlan.SecretsManager.seatPrice,
          quantity: totalSmSeats,
        },
      };

      if (
        smPlan.SecretsManager.hasAdditionalServiceAccountOption &&
        (formValues.secretsManager?.additionalServiceAccounts ?? 0) > 0
      ) {
        cart.secretsManager.additionalServiceAccounts = {
          translationKey: "additionalServiceAccounts",
          cost: smPlan.SecretsManager.additionalPricePerServiceAccount,
          quantity: formValues.secretsManager?.additionalServiceAccounts ?? 0,
        };
      }
    }

    return cart;
  }

  // Private properties
  private readonly logService = inject(LogService);
  private readonly invoicePreviewService = inject(InvoicePreviewService);

  private _familyPlan: PlanType | null = null; // Used to track which Families plan to show when product tier is Families
  private readonly destroy$ = new Subject<void>();

  // Forms
  protected readonly secretsManagerSubscription = secretsManagerSubscribeFormFactory(
    this.formBuilder,
  );

  protected readonly formGroup = this.formBuilder.group({
    name: [""],
    billingEmail: ["", [Validators.email]],
    businessOwned: [false],
    premiumAccessAddon: [false],
    additionalStorage: [0, [Validators.min(0), Validators.max(99)]],
    additionalSeats: [0, [Validators.min(0), Validators.max(100000)]],
    plan: [this.initialPlan()],
    productTier: [this.initialProductTier()],
    secretsManager: this.secretsManagerSubscription,
  });

  // Convert form observables to signals for reactivity
  protected readonly formValues = toSignal(this.formGroup.valueChanges, {
    initialValue: this.formGroup.value,
  });

  protected readonly billingFormGroup = this.formBuilder.group({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  // Emits once the form has been idle for a second. Each emission is a new object, but the `equal`
  // comparator on `previewParams` suppresses a restart when the request is unchanged. The one
  // exception is a failed preview, which the effect in the constructor reloads on every emission.
  private readonly debouncedFormChange = toSignal(
    merge(
      this.formGroup.valueChanges,
      this.billingFormGroup.valueChanges,
      this.secretsManagerForm.valueChanges,
      this.eligibleDiscounts$,
    ).pipe(debounceTime(1000)),
  );

  // Undefined (no preview) for Free, Teams Starter, and an invalid billing address. Form state is
  // read untracked so only the debounced change, not each keystroke, restarts the preview.
  private readonly previewParams = computed<PreviewParams | undefined>(
    () => {
      if (!this.debouncedFormChange()) {
        return undefined;
      }
      return untracked(() => {
        const selectedPlan = this.selectedPlan();
        if (
          !selectedPlan ||
          selectedPlan.type === PlanType.Free ||
          selectedPlan.productTier === ProductTierType.TeamsStarter ||
          this.billingFormGroup.controls.billingAddress.invalid
        ) {
          return undefined;
        }

        const billingAddress = getBillingAddressFromForm(
          this.billingFormGroup.controls.billingAddress,
        );
        if (this.canUpgradeFromPremium()) {
          return {
            kind: "premiumUpgrade",
            request: {
              targetProductTierType: selectedPlan.productTier,
              billingAddress: {
                country: billingAddress.country,
                postalCode: billingAddress.postalCode,
              },
            },
            planName: selectedPlan.name,
          };
        }

        const purchase = this.buildOrganizationPurchase(
          this.formGroup.value.additionalStorage ?? 0,
          this.acceptingSponsorship(),
        );
        const couponIds = this.eligibleCouponIds();
        return {
          kind: "checkout",
          request: {
            purchase: couponIds.length ? { ...purchase, coupons: couponIds } : purchase,
            billingAddress,
          },
        };
      });
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  private readonly previewCart = resource({
    params: this.previewParams,
    loader: async ({ params }) => {
      const cart =
        params.kind === "premiumUpgrade"
          ? await this.invoicePreviewService.previewPremiumOrgUpgradeCart(
              params.request,
              params.planName,
            )
          : await this.invoicePreviewService.previewOrganizationCheckoutCart(params.request);
      return this.withSponsorshipDiscount(cart);
    },
  });

  // resource() clears its value when params change. Keep the last server cart on screen while the
  // next one loads; idle (no preview requested) and error drop it.
  private readonly displayedPreview = linkedSignal<
    { status: string; cart: Cart | undefined },
    Cart | undefined
  >({
    source: () => ({
      status: this.previewCart.status(),
      cart: this.previewCart.hasValue() ? this.previewCart.value() : undefined,
    }),
    computation: (source, previous) =>
      source.cart ??
      (source.status === "loading" || source.status === "reloading" ? previous?.value : undefined),
  });

  protected readonly previewFailed = computed(() => this.previewCart.status() === "error");

  protected readonly previewErrorMessageKey = computed(() =>
    invoicePreviewErrorMessageKey(this.previewCart.error()),
  );

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private toastService: ToastService,
    private accountService: AccountService,
    private subscriberBillingClient: SubscriberBillingClient,
    private configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private premiumOrgUpgradeService: PremiumOrgUpgradeService,
    private subscriptionDiscountService: SubscriptionDiscountService,
  ) {
    this.selfHosted = this.platformUtilsService.isSelfHost();

    effect(() => {
      // Identical params never re-run the resource, so retry explicitly after a failed preview.
      if (this.debouncedFormChange() && untracked(() => this.previewCart.status()) === "error") {
        untracked(() => this.previewCart.reload());
      }
    });

    effect(() => {
      const error = this.previewCart.error();
      if (!error) {
        return;
      }
      untracked(() => {
        this.logService.error("Invoice preview failed:", error);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t(this.previewErrorMessageKey()),
        });
      });
    });
  }

  async ngOnInit() {
    if (!this.selfHosted) {
      await this.loadPlanData();
    }

    this._familyPlan = PlanType.FamiliesAnnually;

    this.formGroup.controls.name.addValidators([Validators.required, Validators.maxLength(50)]);
    this.formGroup.controls.billingEmail.addValidators(Validators.required);

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => singleOrganizationPolicyApplies$(userId, this.policyService)),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.singleOrgPolicyAppliesToActiveUser = policyAppliesToActiveUser;
      });

    this.setInitialPlanSelection();

    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.loading = false;

    if (this.enableSecretsManagerByDefault() && this.selectedSecretsManagerPlan()) {
      this.secretsManagerSubscription.patchValue({
        enabled: true,
        userSeats: 1,
        additionalServiceAccounts: 0,
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get singleOrgPolicyBlock() {
    return this.singleOrgPolicyAppliesToActiveUser;
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.PasswordManager.additionalStoragePricePerGb;
    }
    return selectedPlan.PasswordManager.additionalStoragePricePerGb / 12;
  }

  seatPriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.PasswordManager.seatPrice;
    }
    return selectedPlan.PasswordManager.seatPrice / 12;
  }

  additionalStorageTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalStorageOption) {
      return 0;
    }

    return (
      plan.PasswordManager.additionalStoragePricePerGb *
      Math.abs(this.formGroup.controls.additionalStorage.value || 0)
    );
  }

  passwordManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.PasswordManager.seatPrice * Math.abs(seats || 0);
  }
  get paymentDesc() {
    if (this.acceptingSponsorship()) {
      return this.i18nService.t(
        this.vfo1Enabled() ? "paymentSponsoredFamilyVault" : "paymentSponsored",
      );
    } else if (this.freeTrial() && !this.canUpgradeFromPremium()) {
      return this.i18nService.t(
        "paymentChargedWithTrialSpecificLength",
        this.trialLength() ?? this.selectedPlan()?.trialPeriodDays ?? DEFAULT_TRIAL_LENGTH_DAYS,
      );
    } else {
      return this.i18nService.t("paymentCharged", this.i18nService.t(this.selectedPlanInterval()));
    }
  }

  get secretsManagerForm() {
    return this.formGroup.controls.secretsManager;
  }

  changedProduct() {
    const selectedPlan = this.selectablePlans()[0];

    if (!selectedPlan) {
      return;
    }

    this.setPlanType(selectedPlan.type);
    this.handlePremiumAddonAccess(selectedPlan.PasswordManager.hasPremiumAccessOption);
    this.formGroup.controls.additionalStorage.setValue(0);
    this.handleAdditionalSeats(selectedPlan.PasswordManager.hasAdditionalSeatsOption);
    this.handleSecretsManagerForm();
  }

  setPlanType(planType: PlanType) {
    this.formGroup.controls.plan.setValue(planType);
  }

  handlePremiumAddonAccess(hasPremiumAccessOption: boolean) {
    this.formGroup.controls.premiumAccessAddon.setValue(!hasPremiumAccessOption);
  }

  handleAdditionalSeats(selectedPlanHasAdditionalSeatsOption: boolean) {
    this.formGroup.controls.additionalSeats.setValue(selectedPlanHasAdditionalSeatsOption ? 1 : 0);
  }

  handleSecretsManagerForm() {
    if (this.planOffersSecretsManager()) {
      this.secretsManagerForm.enable();
    }

    if (this.secretsManagerForm.controls.enabled.value) {
      this.secretsManagerForm.controls.userSeats.setValue(1);
      this.secretsManagerForm.controls.additionalServiceAccounts.setValue(0);
    }

    this.secretsManagerForm.updateValueAndValidity();
  }

  changedOwnedBusiness() {
    if (!this.formGroup.controls.businessOwned.value || this.selectedPlan()?.canBeUsedByBusiness) {
      return;
    }
    if (this.teamsStarterPlanIsAvailable()) {
      this.formGroup.controls.productTier.setValue(ProductTierType.TeamsStarter);
      this.formGroup.controls.plan.setValue(PlanType.TeamsStarter);
    } else {
      this.formGroup.controls.productTier.setValue(ProductTierType.Teams);
      this.formGroup.controls.plan.setValue(PlanType.TeamsAnnually);
    }
    this.changedProduct();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    if (this.previewFailed()) {
      return;
    }

    if (this.singleOrgPolicyBlock) {
      return;
    }

    // Validate billing form for paid plans
    if (this.selectedPlan()?.type !== PlanType.Free) {
      this.billingFormGroup.markAllAsTouched();
      if (this.billingFormGroup.invalid) {
        return;
      }
    }

    const doSubmit = async (): Promise<string> => {
      const canUpgradeFromPremium = this.canUpgradeFromPremium();
      const account = await firstValueFrom(this.accountService.activeAccount$);
      let orgId: string;
      if (canUpgradeFromPremium && this.selectedPlan()?.type !== PlanType.Free) {
        orgId = await this.upgradeFromPremiumToOrganization(account!);
      } else {
        const encryptionData =
          await this.premiumOrgUpgradeService.generateOrganizationEncryptionData(account!.id);
        orgId = await this.createCloudHosted(encryptionData);
      }
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("organizationCreated"),
        message: this.i18nService.t("organizationReadyToGo"),
      });

      await this.syncService.fullSync(true);

      if (!this.acceptingSponsorship() && !this.isInTrialFlow) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/organizations/" + orgId]);
      }

      if (this.isInTrialFlow) {
        this.onTrialBillingSuccess.emit({
          orgId: orgId,
          subLabelText: this.billingSubLabelText(),
        });
      }

      return orgId;
    };

    try {
      this.formPromise = doSubmit();
      const organizationId = await this.formPromise;
      this.onSuccess.emit({ organizationId: organizationId });
      // TODO: No one actually listening to this message?
      this.messagingService.send("organizationCreated", { organizationId });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Payment method validation failed") {
        return;
      }
      if (error instanceof ErrorResponse && error.message === "billingTaxIdTypeInferenceError") {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("billingTaxIdTypeInferenceError"),
        });
        return;
      }
      if (this.premiumOrgUpgradeService.isBankAccountNotSupportedError(error)) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("unverifiedBankAccountNotSupportedForUpgrade"),
        });
        return;
      }
      if (this.subscriptionDiscountService.isDiscountExpiredError(error)) {
        this.subscriptionDiscountService.refresh();
        this.toastService.showToast({
          variant: "warning",
          message: this.i18nService.t("discountExpiredOnPurchase"),
        });
        return;
      }
      throw error;
    }
  };

  private getPlanFromLegacyEnum(): OrganizationSubscriptionPlan {
    switch (this.formGroup.value.plan) {
      case PlanType.FamiliesAnnually:
      case PlanType.FamiliesAnnually2025:
        return { tier: "families", cadence: "annually" };
      case PlanType.TeamsMonthly:
        return { tier: "teams", cadence: "monthly" };
      case PlanType.TeamsAnnually:
        return { tier: "teams", cadence: "annually" };
      case PlanType.EnterpriseMonthly:
        return { tier: "enterprise", cadence: "monthly" };
      case PlanType.EnterpriseAnnually:
        return { tier: "enterprise", cadence: "annually" };
      default:
        throw new Error(`Unsupported plan type: ${this.formGroup.value.plan}`);
    }
  }

  private buildOrganizationPurchase(
    additionalStorage: number,
    sponsored: boolean,
  ): OrganizationSubscriptionPurchase {
    const passwordManagerSeats = this.selectedPlan()!.PasswordManager.hasAdditionalSeatsOption
      ? (this.formGroup.value.additionalSeats ?? 0)
      : 1;

    return {
      ...this.getPlanFromLegacyEnum(),
      passwordManager: {
        seats: passwordManagerSeats,
        additionalStorage,
        sponsored,
      },
      secretsManager:
        this.planOffersSecretsManager() && this.formGroup.value.secretsManager?.enabled
          ? {
              seats: this.secretsManagerForm.value.userSeats ?? 0,
              additionalServiceAccounts:
                this.secretsManagerForm.value.additionalServiceAccounts ?? 0,
              standalone: false,
            }
          : undefined,
    };
  }

  private withSponsorshipDiscount(cart: Cart): Cart {
    const seats = cart.passwordManager.seats;
    const sponsorshipDiscount = this.familiesSponsorshipDiscount;
    if (!seats || sponsorshipDiscount <= 0) {
      return cart;
    }

    return {
      ...cart,
      passwordManager: {
        ...cart.passwordManager,
        seats: { ...seats, cost: sponsorshipDiscount },
      },
      discounts: [
        ...(cart.discounts ?? []),
        { type: DiscountTypes.AmountOff, value: sponsorshipDiscount, amount: sponsorshipDiscount },
      ],
    };
  }

  private async createCloudHosted(encryptionData: {
    key: string;
    collectionCt: string;
    orgKeys: [string, EncString];
    orgKey: SymmetricCryptoKey;
    activeUserId: UserId;
  }): Promise<string> {
    const request = new OrganizationCreateRequest(
      encryptionData.key,
      new OrganizationKeysRequest(
        encryptionData.orgKeys[0],
        encryptionData.orgKeys[1].encryptedString as string,
      ),
      encryptionData.collectionCt,
    );
    request.name = this.formGroup.controls.name.value ?? "";
    request.billingEmail = this.formGroup.controls.billingEmail.value ?? "";
    request.initiationPath = this.initiationPath();

    if (this.selectedPlan()!.type === PlanType.Free) {
      request.planType = PlanType.Free;
    } else {
      if (this.billingFormGroup.invalid) {
        throw new Error("Billing form is invalid");
      }

      const paymentMethod = await this.enterPaymentMethodComponent()?.tokenize();
      if (!paymentMethod) {
        throw new Error("Payment method validation failed");
      }

      const billingAddress = getBillingAddressFromForm(
        this.billingFormGroup.controls.billingAddress,
      );

      request.paymentToken = paymentMethod.token;
      request.paymentMethodType = tokenizablePaymentMethodToLegacyEnum(paymentMethod.type);
      request.additionalSeats = this.formGroup.controls.additionalSeats.value ?? 0;
      request.additionalStorageGb = this.formGroup.controls.additionalStorage.value ?? 0;
      request.premiumAccessAddon =
        (this.selectedPlan()?.PasswordManager.hasPremiumAccessOption ?? false) &&
        (this.formGroup.controls.premiumAccessAddon.value ?? false);
      request.planType = this.selectedPlan()!.type;
      request.billingAddressPostalCode = billingAddress.postalCode ?? "";
      request.billingAddressCountry = billingAddress.country ?? "";
      request.taxIdNumber = billingAddress.taxId?.value ?? "";
      request.billingAddressLine1 = billingAddress.line1 ?? "";
      request.billingAddressLine2 = billingAddress.line2 ?? "";
      request.billingAddressCity = billingAddress.city ?? "";
      request.billingAddressState = billingAddress.state ?? "";
    }

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.eligibleCouponIds().length > 0) {
      request.coupons = this.eligibleCouponIds();
    }

    const trialLength = this.trialLength();
    if (trialLength !== undefined) {
      request.trialLength = trialLength;
    }

    return (await this.organizationApiService.create(request)).id;
  }

  private billingSubLabelText(): string {
    const selectedPlan = this.selectedPlan();
    if (!selectedPlan) {
      return "";
    }
    const price =
      selectedPlan.PasswordManager.basePrice === 0
        ? selectedPlan.PasswordManager.seatPrice
        : selectedPlan.PasswordManager.basePrice;
    let text = "";

    if (selectedPlan.isAnnual) {
      text += `${this.i18nService.t("annual")} ($${price}/${this.i18nService.t("yr")})`;
    } else {
      text += `${this.i18nService.t("monthly")} ($${price}/${this.i18nService.t("monthAbbr")})`;
    }

    return text;
  }

  private buildSecretsManagerRequest(request: OrganizationCreateRequest): void {
    const formValues = this.secretsManagerForm.value;

    request.useSecretsManager = this.planOffersSecretsManager() && (formValues.enabled ?? false);

    if (!request.useSecretsManager) {
      return;
    }

    if (this.selectedSecretsManagerPlan()!.SecretsManager.hasAdditionalSeatsOption) {
      request.additionalSmSeats = formValues.userSeats ?? 0;
    }

    if (this.selectedSecretsManagerPlan()!.SecretsManager.hasAdditionalServiceAccountOption) {
      request.additionalServiceAccounts = formValues.additionalServiceAccounts ?? 0;
    }
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }

  /**
   * Loads available plans from the API and filters them into password manager and secrets manager plans.
   * Also sets the businessOwned form control to true if the current product tier is Enterprise or Teams.
   */
  private async loadPlanData(): Promise<void> {
    const plans = await this.apiService.getPlans();
    this.passwordManagerPlans = plans.data.filter((plan) => !!plan.PasswordManager);
    this.secretsManagerPlans = plans.data.filter((plan) => !!plan.SecretsManager);

    if (
      this.formGroup.controls.productTier.value === ProductTierType.Enterprise ||
      this.formGroup.controls.productTier.value === ProductTierType.Teams
    ) {
      this.formGroup.controls.businessOwned.setValue(true);
    }
  }

  /**
   * Sets the initial plan and product tier from the initialPlan and initialProductTier inputs.
   */
  private setInitialPlanSelection(): void {
    // Set initial values from inputs
    const initialPlan = this.initialPlan();
    const initialProductTier = this.initialProductTier();

    // Set plan
    if (initialPlan !== PlanType.Free) {
      this.formGroup.controls.plan.setValue(initialPlan);
    }
    // Set product tier
    if (initialProductTier !== ProductTierType.Free) {
      this.formGroup.controls.productTier.setValue(initialProductTier);
    }
  }

  protected async onLicenseFileUploaded(organizationId: string): Promise<void> {
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("organizationCreated"),
      message: this.i18nService.t("organizationReadyToGo"),
    });

    if (!this.acceptingSponsorship() && !this.isInTrialFlow) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/organizations/" + organizationId]);
    }

    if (this.isInTrialFlow) {
      this.onTrialBillingSuccess.emit({
        orgId: organizationId,
        subLabelText: this.billingSubLabelText(),
      });
    }

    this.onSuccess.emit({ organizationId: organizationId });

    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId: organizationId });
  }

  private async upgradeFromPremiumToOrganization(account: Account): Promise<string> {
    const organizationName = this.formGroup.controls.name.value ?? "";
    const billingAddress = getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress);
    const tier = this.premiumOrgUpgradeService.SubscriptionTierIdFromProductTier(
      this.formGroup.controls.productTier.value!,
    );

    const paymentMethod = await this.enterPaymentMethodComponent()?.tokenize();
    if (!paymentMethod) {
      throw new Error("Payment method validation failed");
    }

    await this.subscriberBillingClient.updatePaymentMethod(
      { type: "account", data: account },
      paymentMethod,
      {
        country: this.billingFormGroup.value.billingAddress?.country ?? "",
        postalCode: this.billingFormGroup.value.billingAddress?.postalCode ?? "",
      },
    );

    return await this.premiumOrgUpgradeService.upgradeToOrganization(
      account!,
      organizationName,
      tier,
      billingAddress,
    );
  }
}
