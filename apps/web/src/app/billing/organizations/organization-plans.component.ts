import {
  Component,
  computed,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, merge, Subject, takeUntil } from "rxjs";
import { debounceTime, filter, map, switchMap } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { ProviderOrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-organization-create.request";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PlanSponsorshipType, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { IconComponent, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Cart, CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";
import {
  AccountBillingClient,
  OrganizationSubscriptionPlan,
  OrganizationSubscriptionPurchase,
  PreviewInvoiceClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { tokenizablePaymentMethodToLegacyEnum } from "@bitwarden/web-vault/app/billing/payment/types";

import { OrganizationCreateModule } from "../../admin-console/organizations/create/organization-create.module";
import { PremiumOrgUpgradeService } from "../individual/upgrade/premium-org-upgrade-payment/services/premium-org-upgrade.service";
import { BillingSharedModule, secretsManagerSubscribeFormFactory } from "../shared";

interface OnSuccessArgs {
  organizationId: string;
}
interface OnTrialBillingSuccessArgs {
  orgId: string;
  subLabelText: string;
}

const Allowed2020PlansForLegacyProviders = [
  PlanType.TeamsMonthly2020,
  PlanType.TeamsAnnually2020,
  PlanType.EnterpriseAnnually2020,
  PlanType.EnterpriseMonthly2020,
];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-plans",
  templateUrl: "organization-plans.component.html",
  imports: [
    BillingSharedModule,
    OrganizationCreateModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    IconComponent,
    CartSummaryComponent,
  ],
  providers: [
    AccountBillingClient,
    SubscriberBillingClient,
    PreviewInvoiceClient,
    PremiumOrgUpgradeService,
  ],
})
export class OrganizationPlansComponent implements OnInit, OnDestroy {
  // ViewChildren
  readonly enterPaymentMethodComponent = viewChild(EnterPaymentMethodComponent);

  // Inputs
  readonly organizationId = input<string | null>(null);
  readonly providerId = input<string | null>(null);
  readonly showFree = input(true);
  readonly showCancel = input(false);
  readonly acceptingSponsorship = input<boolean>(false);
  readonly planSponsorshipType = input<PlanSponsorshipType | null>(null);
  readonly currentPlan = input<PlanResponse | null>(null);
  readonly preSelectedProductTier = input<ProductTierType | null>(null);
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
  readonly createOrganization = computed(() => this.organizationId() == null);
  readonly hasProvider = computed(() => this.providerId() != null);

  /**
   * Determines whether the user can upgrade from Premium to an organization plan.
   * This is true if the user has a Premium subscription personally and is creating a new organization (as opposed to being invited to an existing one) or upgrading.
   * Also checks that the relevant feature flag is enabled
   */
  readonly canUpgradeFromPremium = computed<boolean>(() => {
    const hasPremiumPersonally = this.hasPremiumPersonally();
    const premiumToOrganizationUpgradeFeatureFlagEnabled =
      this.premiumToOrganizationUpgradeFeatureFlagEnabled();
    const isCreatingOrganization = this.createOrganization();
    return (
      hasPremiumPersonally &&
      isCreatingOrganization &&
      premiumToOrganizationUpgradeFeatureFlagEnabled
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

  readonly freeTrial = computed(() => this.selectedPlan()?.trialPeriodDays != null);

  readonly planOffersSecretsManager = computed(() => this.selectedSecretsManagerPlan() != null);

  readonly selectableProducts = computed(() => {
    if (this.acceptingSponsorship()) {
      const familyPlan = this.passwordManagerPlans.find((plan) => plan.type === this._familyPlan);
      return [familyPlan];
    }

    const businessOwnedIsChecked = this.formValues().businessOwned;

    const result = this.passwordManagerPlans.filter((plan) => {
      const currentPlan = this.currentPlan();
      return (
        plan.type !== PlanType.Custom &&
        (!businessOwnedIsChecked || plan.canBeUsedByBusiness) &&
        (this.showFree() || plan.productTier !== ProductTierType.Free) &&
        (plan.isAnnual ||
          plan.productTier === ProductTierType.Free ||
          plan.productTier === ProductTierType.TeamsStarter) &&
        (!currentPlan || currentPlan.upgradeSortOrder < plan.upgradeSortOrder) &&
        (!this.hasProvider() || plan.productTier !== ProductTierType.TeamsStarter) &&
        (plan.productTier !== ProductTierType.Families || plan.type === this._familyPlan) &&
        ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
          (this.isProviderQualifiedFor2020Plan() &&
            Allowed2020PlansForLegacyProviders.includes(plan.type)))
      );
    });

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  });

  readonly selectablePlans = computed(() => {
    const selectedProductTierType = this.formValues().productTier;
    const result =
      this.passwordManagerPlans?.filter(
        (plan) =>
          plan.productTier === selectedProductTierType &&
          (plan.productTier !== ProductTierType.Families || plan.type === this._familyPlan) &&
          ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
            (this.isProviderQualifiedFor2020Plan() &&
              Allowed2020PlansForLegacyProviders.includes(plan.type))),
      ) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);
    return result;
  });

  readonly teamsStarterPlanIsAvailable = computed(() =>
    this.selectablePlans().some((plan) => plan.type === PlanType.TeamsStarter),
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
  readonly onCanceled = output<void>();
  readonly onTrialBillingSuccess = output<OnTrialBillingSuccessArgs>();

  // State properties
  protected loading = true;
  protected selfHosted = false;
  protected readonly productTypes = ProductTierType;
  protected formPromise: Promise<string> | null = null;
  protected singleOrgPolicyAppliesToActiveUser = false;
  protected isInTrialFlow = false;

  protected get discount(): number {
    if (!this.acceptingSponsorship()) {
      return 0;
    }
    const familyPlan = this.passwordManagerPlans.find((plan) => plan.type === this._familyPlan);
    return familyPlan?.PasswordManager.basePrice ?? 0;
  }

  // Plan data
  protected passwordManagerPlans: PlanResponse[] = [];
  protected secretsManagerPlans: PlanResponse[] = [];

  // Organization data
  protected organization: Organization | null = null;
  protected sub: OrganizationSubscriptionResponse | null = null;
  protected billing: BillingResponse | null = null;
  protected provider: ProviderResponse | null = null;

  // Invoice preview for premium user upgrades to organization
  protected readonly previewInvoice = signal<{
    tax: number;
    total: number;
    credit: number;
    newPlanProratedMonths: number;
    newPlanProratedAmount: number;
  } | null>(null);

  // Estimated tax for non-premium users
  protected readonly estimatedTax = signal(0);

  // Cart for CartSummary component
  protected readonly cart = computed<Cart>(() => {
    const formValues = this.formValues();
    const previewInvoice = this.previewInvoice();
    const estimatedTax = this.estimatedTax();
    const plan = this.selectedPlan();
    let cart: Cart;

    if (!plan) {
      return {
        passwordManager: {
          seats: { translationKey: "passwordManager", cost: 0, quantity: 1, hideBreakdown: true },
        },
        cadence: "annually",
        estimatedTax: estimatedTax,
      };
    }

    const hasAdditionalSeats =
      plan.PasswordManager.hasAdditionalSeatsOption && formValues.additionalSeats;
    const pmBaseCost = hasAdditionalSeats
      ? plan.PasswordManager.seatPrice
      : plan.PasswordManager.basePrice;
    const totalSeats = hasAdditionalSeats ? (formValues.additionalSeats ?? 0) : 1;

    // For prorated upgrades, use prorated amount and hide breakdown
    if (this.canUpgradeFromPremium()) {
      if (!previewInvoice) {
        return {
          passwordManager: {
            seats: {
              translationKey: "passwordManagerPlanPrice",
              cost: pmBaseCost,
              quantity: totalSeats,
              hideBreakdown: true,
            },
          },
          cadence: plan.isAnnual ? "annually" : "monthly",
          estimatedTax: 0,
        };
      }

      const translationKey = "planProratedMembershipInMonths";
      const translationParams = [
        plan.name,
        `${previewInvoice.newPlanProratedMonths} month${previewInvoice.newPlanProratedMonths > 1 ? "s" : ""}`,
      ];

      cart = {
        passwordManager: {
          seats: {
            translationKey,
            translationParams,
            cost: previewInvoice.newPlanProratedAmount,
            quantity: 1,
            hideBreakdown: true,
          },
        },
        cadence: plan.isAnnual ? "annually" : "monthly",
        estimatedTax: previewInvoice.tax,
        credit: { translationKey: "premiumSubscriptionCredit", value: previewInvoice.credit },
      };
    } else {
      // Calculate PM base cost (includes base price, additional seats, and premium addon)
      let adjustedPmBaseCost = pmBaseCost;

      if (plan.PasswordManager.hasPremiumAccessOption && formValues.premiumAccessAddon) {
        adjustedPmBaseCost += plan.PasswordManager.premiumAccessOptionPrice;
      }
      cart = {
        passwordManager: {
          seats: {
            translationKey: "passwordManagerPlanPrice",
            cost: adjustedPmBaseCost,
            quantity: totalSeats,
          },
        },
        cadence: plan.isAnnual ? "annually" : "monthly",
        estimatedTax: estimatedTax,
      };

      // Add discount if accepting sponsorship
      if (this.acceptingSponsorship() && this.discount > 0) {
        cart.discount = {
          type: DiscountTypes.AmountOff,
          value: this.discount,
        };
      }

      // Add additional storage if applicable
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

      // Add secrets manager if enabled
      if (this.planOffersSecretsManager() && formValues.secretsManager?.enabled) {
        const smPlan = this.selectedSecretsManagerPlan()!;

        // Calculate SM base cost (includes base price and user seats)
        let totalSmSeats = smPlan.SecretsManager.baseSeats;
        const smBaseCost = smPlan.SecretsManager.seatPrice;

        if (
          smPlan.SecretsManager.hasAdditionalSeatsOption &&
          (formValues.secretsManager?.userSeats ?? 0) > 0
        ) {
          totalSmSeats += formValues.secretsManager?.userSeats ?? 0;
        }

        cart.secretsManager = {
          seats: {
            translationKey: "secretsManagerPlanPrice",
            cost: smBaseCost,
            quantity: totalSmSeats,
          },
        };

        // Add service accounts if applicable
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
    }
    return cart;
  });

  // Private properties
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
    clientOwnerEmail: ["", [Validators.email]],
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

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private providerApiService: ProviderApiServiceAbstraction,
    private toastService: ToastService,
    private accountService: AccountService,
    private subscriberBillingClient: SubscriberBillingClient,
    private previewInvoiceClient: PreviewInvoiceClient,
    private configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private premiumOrgUpgradeService: PremiumOrgUpgradeService,
  ) {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    const organizationId = this.organizationId();

    if (organizationId) {
      await this.loadExistingOrganizationData(organizationId);
    }

    if (!this.selfHosted) {
      await this.loadPlanData();
    }

    this._familyPlan = await this.determineFamilyPlan();

    const currentPlan = this.currentPlan();
    if (currentPlan) {
      this.preselectUpgradePlan(currentPlan);
    }

    if (this.hasProvider()) {
      await this.setupProviderConfiguration();
    }

    if (!this.createOrganization()) {
      this.upgradeFlowPrefillForm();
    } else {
      this.formGroup.controls.name.addValidators([Validators.required, Validators.maxLength(50)]);
      this.formGroup.controls.billingEmail.addValidators(Validators.required);
    }

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.singleOrgPolicyAppliesToActiveUser = policyAppliesToActiveUser;
      });

    // Set initial values from inputs, allowing preSelectedProductTier to take precedence if higher
    const initialPlan = this.initialPlan();
    const initialProductTier = this.initialProductTier();
    const preSelectedProductTier = this.preSelectedProductTier();
    if (initialPlan !== PlanType.Free) {
      this.formGroup.controls.plan.setValue(initialPlan);
    }
    if (initialProductTier !== ProductTierType.Free) {
      this.formGroup.controls.productTier.setValue(initialProductTier);
    }

    if (
      preSelectedProductTier != null &&
      (this.formGroup.controls.productTier.value ?? 0) < preSelectedProductTier
    ) {
      this.formGroup.controls.productTier.setValue(preSelectedProductTier);
    }

    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.loading = false;

    merge(
      this.formGroup.valueChanges,
      this.billingFormGroup.valueChanges,
      this.secretsManagerForm.valueChanges,
    )
      .pipe(
        debounceTime(1000),
        switchMap(async () => await this.refreshSalesTax()),
        takeUntil(this.destroy$),
      )
      .subscribe();

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
    return this.singleOrgPolicyAppliesToActiveUser && !this.hasProvider();
  }

  get upgradeRequiresPaymentMethod() {
    return (
      this.organization?.productTierType === ProductTierType.Free &&
      !this.showFree() &&
      !this.billing?.paymentSource
    );
  }

  isProviderQualifiedFor2020Plan() {
    const targetDate = new Date("2023-11-06");

    if (!this.provider || !this.provider.creationDate) {
      return false;
    }

    const creationDate = new Date(this.provider.creationDate);
    return creationDate < targetDate;
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

  secretsManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.SecretsManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.SecretsManager.seatPrice * Math.abs(seats || 0);
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    if (!plan.SecretsManager.hasAdditionalServiceAccountOption) {
      return 0;
    }

    return (
      plan.SecretsManager.additionalPricePerServiceAccount *
      Math.abs(this.secretsManagerForm.value.additionalServiceAccounts || 0)
    );
  }

  get passwordManagerSubtotal() {
    const plan = this.selectedPlan();
    if (!plan) {
      return 0;
    }
    const basePriceAfterDiscount = this.acceptingSponsorship()
      ? Math.max(plan.PasswordManager.basePrice - this.discount, 0)
      : plan.PasswordManager.basePrice;
    let subTotal = basePriceAfterDiscount;
    if (
      plan.PasswordManager.hasAdditionalSeatsOption &&
      this.formGroup.controls.additionalSeats.value
    ) {
      subTotal += this.passwordManagerSeatTotal(plan, this.formGroup.value.additionalSeats ?? 0);
    }
    if (
      plan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value
    ) {
      subTotal += plan.PasswordManager.premiumAccessOptionPrice;
    }
    if (
      plan.PasswordManager.hasAdditionalStorageOption &&
      this.formGroup.controls.additionalStorage.value
    ) {
      subTotal += this.additionalStorageTotal(plan);
    }
    return subTotal;
  }

  get secretsManagerSubtotal() {
    const plan = this.selectedSecretsManagerPlan();
    const formValues = this.secretsManagerForm.value;

    if (!this.planOffersSecretsManager() || !formValues.enabled || !plan) {
      return 0;
    }

    return (
      plan.SecretsManager.basePrice +
      this.secretsManagerSeatTotal(plan, formValues.userSeats ?? 0) +
      this.additionalServiceAccountTotal(plan)
    );
  }

  get paymentDesc() {
    if (this.acceptingSponsorship()) {
      return this.i18nService.t("paymentSponsored");
    } else if (this.freeTrial() && this.createOrganization() && !this.canUpgradeFromPremium()) {
      return this.i18nService.t("paymentChargedWithTrial");
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
    this.handleAdditionalStorage(selectedPlan.PasswordManager.hasAdditionalStorageOption);
    this.handleAdditionalSeats(selectedPlan.PasswordManager.hasAdditionalSeatsOption);
    this.handleSecretsManagerForm();
  }

  setPlanType(planType: PlanType) {
    this.formGroup.controls.plan.setValue(planType);
  }

  handlePremiumAddonAccess(hasPremiumAccessOption: boolean) {
    this.formGroup.controls.premiumAccessAddon.setValue(!hasPremiumAccessOption);
  }

  handleAdditionalStorage(selectedPlanHasAdditionalStorageOption: boolean) {
    const currentPlan = this.currentPlan();
    if (!selectedPlanHasAdditionalStorageOption || !currentPlan) {
      this.formGroup.controls.additionalStorage.setValue(0);
      return;
    }

    if (this.organization?.maxStorageGb) {
      this.formGroup.controls.additionalStorage.setValue(
        this.organization.maxStorageGb - currentPlan.PasswordManager.baseStorageGb,
      );
    }
  }

  handleAdditionalSeats(selectedPlanHasAdditionalSeatsOption: boolean) {
    if (!selectedPlanHasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(0);
      return;
    }

    const currentPlan = this.currentPlan();
    if (currentPlan && !currentPlan.PasswordManager.hasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(currentPlan.PasswordManager.baseSeats);
      return;
    }

    if (this.organization) {
      this.formGroup.controls.additionalSeats.setValue(this.organization.seats);
      return;
    }

    this.formGroup.controls.additionalSeats.setValue(1);
  }

  handleSecretsManagerForm() {
    if (this.planOffersSecretsManager()) {
      this.secretsManagerForm.enable();
    }

    if (this.organization?.useSecretsManager) {
      this.secretsManagerForm.controls.enabled.setValue(true);
    }

    if (this.secretsManagerForm.controls.enabled.value) {
      this.secretsManagerForm.controls.userSeats.setValue(this.sub?.smSeats || 1);
      this.secretsManagerForm.controls.additionalServiceAccounts.setValue(
        (this.sub?.smServiceAccounts ?? 0) -
          (this.currentPlan()?.SecretsManager?.baseServiceAccount ?? 0),
      );
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

  protected cancel(): void {
    this.onCanceled.emit();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    if (this.singleOrgPolicyBlock) {
      return;
    }

    // Validate billing form for paid plans during creation
    if (this.createOrganization() && this.selectedPlan()?.type !== PlanType.Free) {
      this.billingFormGroup.markAllAsTouched();
      if (this.billingFormGroup.invalid) {
        return;
      }
    }
    const doSubmit = async (): Promise<string> => {
      let orgId: string;
      if (this.createOrganization()) {
        const canUpgradeFromPremium = this.canUpgradeFromPremium();
        const account = await firstValueFrom(this.accountService.activeAccount$);
        if (canUpgradeFromPremium) {
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
      } else {
        orgId = await this.updateOrganization();
        this.toastService.showToast({
          variant: "success",
          title: undefined,
          message: this.i18nService.t("organizationUpgraded"),
        });
      }

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

  private buildTaxPreviewRequest(
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
      secretsManager: this.formGroup.value.secretsManager?.enabled
        ? {
            seats: this.secretsManagerForm.value.userSeats ?? 0,
            additionalServiceAccounts: this.secretsManagerForm.value.additionalServiceAccounts ?? 0,
            standalone: false,
          }
        : undefined,
    };
  }

  private async refreshSalesTax(): Promise<void> {
    if (this.billingFormGroup.controls.billingAddress.invalid) {
      return;
    }

    const billingAddress = getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress);

    // If premium user is upgrading to organization, get proration preview with credit
    if (this.canUpgradeFromPremium()) {
      const prorationPreview = await this.previewInvoiceClient.previewProrationForPremiumUpgrade(
        this.formValues().productTier!,
        {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
        },
      );
      this.previewInvoice.set({
        tax: prorationPreview.tax,
        total: prorationPreview.total,
        credit: prorationPreview.credit,
        newPlanProratedMonths: prorationPreview.newPlanProratedMonths,
        newPlanProratedAmount: prorationPreview.newPlanProratedAmount,
      });
      return;
    }

    // Standard tax calculation for non-premium upgrades
    // should still be taxed. We mark the plan as NOT sponsored when there is additional storage
    // so the server calculates tax, but we'll adjust the calculation to only tax the storage.
    const hasPaidStorage = (this.formGroup.value.additionalStorage || 0) > 0;
    const sponsoredForTaxPreview = this.acceptingSponsorship() && !hasPaidStorage;

    if (this.acceptingSponsorship() && hasPaidStorage) {
      // For sponsored plans with paid storage, calculate tax only on storage
      // by comparing tax on base+storage vs tax on base only
      //TODO: Move this logic to PreviewOrganizationTaxCommand - https://bitwarden.atlassian.net/browse/PM-27585
      const [baseTaxAmounts, fullTaxAmounts] = await Promise.all([
        this.previewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase(
          this.buildTaxPreviewRequest(0, false),
          billingAddress,
        ),
        this.previewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase(
          this.buildTaxPreviewRequest(this.formGroup.value.additionalStorage ?? 0, false),
          billingAddress,
        ),
      ]);

      // Tax on storage = Tax on (base + storage) - Tax on (base only)
      this.estimatedTax.set(fullTaxAmounts.tax - baseTaxAmounts.tax);
    } else {
      const taxAmounts =
        await this.previewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase(
          this.buildTaxPreviewRequest(
            this.formGroup.value.additionalStorage ?? 0,
            sponsoredForTaxPreview,
          ),
          billingAddress,
        );

      this.estimatedTax.set(taxAmounts.tax);
    }
  }

  private async updateOrganization() {
    const request = new OrganizationUpgradeRequest();
    request.additionalSeats = this.formGroup.controls.additionalSeats.value ?? 0;
    request.additionalStorageGb = this.formGroup.controls.additionalStorage.value ?? 0;
    request.premiumAccessAddon =
      (this.selectedPlan()?.PasswordManager.hasPremiumAccessOption ?? false) &&
      (this.formGroup.controls.premiumAccessAddon.value ?? false);
    request.planType = this.selectedPlan()!.type;
    request.billingAddressCountry = this.billingFormGroup.value.billingAddress?.country ?? "";
    request.billingAddressPostalCode = this.billingFormGroup.value.billingAddress?.postalCode ?? "";

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.upgradeRequiresPaymentMethod) {
      if (this.billingFormGroup.invalid) {
        throw new Error("Billing form is invalid");
      }
      const paymentMethod = await this.enterPaymentMethodComponent()?.tokenize();
      if (!paymentMethod) {
        throw new Error("Payment method validation failed");
      }
      await this.subscriberBillingClient.updatePaymentMethod(
        { type: "organization", data: this.organization! },
        paymentMethod,
        {
          country: this.billingFormGroup.value.billingAddress?.country ?? "",
          postalCode: this.billingFormGroup.value.billingAddress?.postalCode ?? "",
        },
      );
    }

    // Backfill pub/priv key if necessary
    if (!this.organization!.hasPublicAndPrivateKeys) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const orgShareKey = await firstValueFrom(
        this.keyService
          .orgKeys$(userId!)
          .pipe(map((orgKeys) => orgKeys?.[this.organizationId() as OrganizationId] ?? null)),
      );
      const orgKeys = await this.keyService.makeKeyPair(orgShareKey!);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString as string);
    }

    await this.organizationApiService.upgrade(this.organizationId()!, request);
    return this.organizationId()!;
  }

  private async createCloudHosted(encryptionData: {
    key: string;
    collectionCt: string;
    orgKeys: [string, EncString];
    orgKey: SymmetricCryptoKey;
    activeUserId: UserId;
  }): Promise<string> {
    const request = new OrganizationCreateRequest();
    request.key = encryptionData.key;
    request.collectionName = encryptionData.collectionCt;
    request.name = this.formGroup.controls.name.value ?? "";
    request.billingEmail = this.formGroup.controls.billingEmail.value ?? "";
    request.initiationPath = "New organization creation in-product";
    request.keys = new OrganizationKeysRequest(
      encryptionData.orgKeys[0],
      encryptionData.orgKeys[1].encryptedString as string,
    );

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

    if (this.hasProvider()) {
      const providerRequest = new ProviderOrganizationCreateRequest(
        this.formGroup.controls.clientOwnerEmail.value ?? "",
        request,
      );

      const providerKey = await firstValueFrom(
        this.keyService
          .providerKeys$(encryptionData.activeUserId)
          .pipe(map((providerKeys) => providerKeys?.[this.providerId() as ProviderId] ?? null)),
      );
      assertNonNullish(providerKey, "Provider key not found");

      providerRequest.organizationCreateRequest.key = (
        await this.encryptService.wrapSymmetricKey(encryptionData.orgKey, providerKey)
      ).encryptedString as string;
      const orgId = (
        await this.apiService.postProviderCreateOrganization(this.providerId()!, providerRequest)
      ).organizationId;

      return orgId;
    } else {
      return (await this.organizationApiService.create(request)).id;
    }
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

  private buildSecretsManagerRequest(
    request: OrganizationCreateRequest | OrganizationUpgradeRequest,
  ): void {
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

  private upgradeFlowPrefillForm() {
    if (this.acceptingSponsorship()) {
      this.formGroup.controls.productTier.setValue(ProductTierType.Families);
      this.changedProduct();
      return;
    }

    const currentPlan = this.currentPlan();
    if (currentPlan && currentPlan.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) => {
        if (currentPlan.productTier === ProductTierType.Free) {
          return plan.type === this._familyPlan;
        }

        if (
          currentPlan.productTier === ProductTierType.Families &&
          !this.teamsStarterPlanIsAvailable()
        ) {
          return plan.type === PlanType.TeamsAnnually;
        }

        return plan.upgradeSortOrder === currentPlan.upgradeSortOrder + 1;
      });

      if (upgradedPlan) {
        this.formGroup.controls.plan.setValue(upgradedPlan.type);
        this.formGroup.controls.productTier.setValue(upgradedPlan.productTier);
        this.changedProduct();
      }
    }
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }

  private async determineFamilyPlan(): Promise<PlanType> {
    const milestone3FeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM26462_Milestone_3,
    );
    return milestone3FeatureEnabled ? PlanType.FamiliesAnnually : PlanType.FamiliesAnnually2025;
  }

  /**
   * Loads existing organization, billing, and subscription data for the given organization ID
   * and populates the form controls with the retrieved billing address.
   * @param organizationId
   */
  private async loadExistingOrganizationData(organizationId: string): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    this.organization =
      (await firstValueFrom(
        this.organizationService.organizations$(userId!).pipe(getOrganizationById(organizationId)),
      )) ?? null;
    this.billing = await this.organizationApiService.getBilling(organizationId);
    this.sub = await this.organizationApiService.getSubscription(organizationId);
    const billingAddress = await this.subscriberBillingClient.getBillingAddress({
      type: "organization",
      data: this.organization!,
    });
    this.billingFormGroup.controls.billingAddress.patchValue({
      ...billingAddress,
      taxId: billingAddress?.taxId?.value,
    });
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
   * Preselects the next available upgrade plan based on the provided current plan.
   * For free users, selects the family plan; for others, selects the next plan by upgrade sort order.
   * @param currentPlan
   */
  private preselectUpgradePlan(currentPlan: PlanResponse): void {
    if (currentPlan.productTier == ProductTierType.Enterprise) {
      return;
    }

    const upgradedPlan = this.passwordManagerPlans.find((plan) => {
      return currentPlan.productTier === ProductTierType.Free
        ? plan.type === this._familyPlan
        : plan.upgradeSortOrder == currentPlan.upgradeSortOrder + 1;
    });

    if (upgradedPlan) {
      this.formGroup.controls.plan.setValue(upgradedPlan.type);
      this.formGroup.controls.productTier.setValue(upgradedPlan.productTier);
    }
  }

  /**
   * Configures the form for provider-managed organizations by setting business ownership,
   * adding required validators, loading provider data, and preselecting the default Teams plan.
   */
  private async setupProviderConfiguration(): Promise<void> {
    this.formGroup.controls.businessOwned.setValue(true);
    this.formGroup.controls.clientOwnerEmail.addValidators(Validators.required);
    this.changedOwnedBusiness();
    this.provider = await this.providerApiService.getProvider(this.providerId()!);
    const providerDefaultPlan = this.passwordManagerPlans.find(
      (plan) => plan.type === PlanType.TeamsAnnually,
    );
    if (providerDefaultPlan) {
      this.formGroup.controls.plan.setValue(providerDefaultPlan.type);
      this.formGroup.controls.productTier.setValue(providerDefaultPlan.productTier);
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
    return await this.premiumOrgUpgradeService.upgradeToOrganization(
      account!,
      organizationName,
      tier,
      billingAddress,
    );
  }
}
