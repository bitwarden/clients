// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  computed,
  Inject,
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
import { combineLatest, firstValueFrom, map, Subject, switchMap, takeUntil } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
  singleOrganizationPolicyApplies$,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlanInterval, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  CardComponent,
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Cart, CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";
import {
  OrganizationSubscriptionPlan,
  SubscriberBillingClient,
  PreviewInvoiceClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  BillingAddress,
  getCardBrandIcon,
  MaskedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";
import { BitwardenSubscriber } from "@bitwarden/web-vault/app/billing/types";

import { BillingNotificationService } from "../services/billing-notification.service";
import { BillingSharedModule } from "../shared/billing-shared.module";

type ChangePlanDialogParams = {
  organizationId: string;
  productTierType: ProductTierType;
  subscription?: OrganizationSubscriptionResponse;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ChangePlanDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PlanCardState {
  Selected = "selected",
  NotSelected = "not_selected",
  Disabled = "disabled",
}

export const openChangePlanDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<ChangePlanDialogParams>,
) =>
  dialogService.open<ChangePlanDialogResultType, ChangePlanDialogParams>(
    ChangePlanDialogComponent,
    dialogConfig,
  );

type PlanCard = {
  name: string;
  selected: boolean;
};

interface OnSuccessArgs {
  organizationId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./change-plan-dialog.component.html",
  imports: [
    BillingSharedModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    CardComponent,
    CartSummaryComponent,
  ],
})
export class ChangePlanDialogComponent implements OnInit, OnDestroy {
  // ViewChildren
  readonly enterPaymentMethodComponent = viewChild(EnterPaymentMethodComponent);

  // Inputs
  readonly acceptingSponsorship = input(false);
  readonly showFree = input(false);
  readonly showCancel = input(false);
  readonly providerId = input<string | null>(null);

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

  // Outputs
  readonly onSuccess = output<OnSuccessArgs>();
  readonly onCanceled = output<void>();
  readonly onTrialBillingSuccess = output<{ orgId: string; subLabelText: string }>();

  // Signal-based state
  protected readonly estimatedTax = signal(0);
  protected readonly discount = signal(0);
  private readonly _familyPlan = signal<PlanType | null>(null);
  protected readonly discountPercentageFromSub = signal(0);
  protected readonly loading = signal(true);
  protected readonly planCards = signal<PlanCard[]>([]);
  protected readonly ResultType = ChangePlanDialogResultType;
  protected readonly selfHosted = signal(false);
  protected readonly productTypes = ProductTierType;
  protected readonly formPromise = signal<Promise<string> | null>(null);
  protected readonly singleOrgPolicyAppliesToActiveUser = signal(false);
  protected readonly isInTrialFlow = signal(false);

  formGroup = this.formBuilder.group({
    name: [""],
    billingEmail: ["", [Validators.email]],
    businessOwned: [false],
    premiumAccessAddon: [false],
    additionalSeats: [0, [Validators.min(0), Validators.max(100000)]],
    clientOwnerEmail: ["", [Validators.email]],
    plan: [this.initialPlan()],
    productTier: [this.initialProductTier()],
  });

  // Convert form observables to signals for reactivity
  protected readonly formValues = toSignal(this.formGroup.valueChanges, {
    initialValue: this.formGroup.value,
  });

  billingFormGroup = this.formBuilder.group({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  readonly planType = signal<string>("");
  readonly selectedPlan = signal<PlanResponse | null>(null);
  readonly selectedInterval = signal<number>(1);
  readonly planIntervals = PlanInterval;
  readonly passwordManagerPlans = signal<PlanResponse[]>([]);
  readonly secretsManagerPlans = signal<PlanResponse[]>([]);
  readonly organization = signal<Organization | null>(null);
  readonly sub = signal<OrganizationSubscriptionResponse | null>(null);
  readonly dialogHeaderName = signal<string>("");
  readonly currentPlanName = signal<string>("");
  readonly showPayment = signal<boolean>(false);
  readonly totalOpened = signal<boolean>(false);
  readonly currentPlan = signal<PlanResponse | null>(null);
  readonly focusedIndex = signal<number | null>(null);
  readonly plans = signal<ListResponse<PlanResponse> | null>(null);
  readonly isSubscriptionCanceled = signal<boolean>(false);
  readonly secretsManagerTotal = signal<number>(0);
  readonly organizationId = signal<string>("");

  readonly paymentMethod = signal<MaskedPaymentMethod | null>(null);
  readonly billingAddress = signal<BillingAddress | null>(null);

  private destroy$ = new Subject<void>();

  // Computed signals
  readonly upgradeRequiresPaymentMethod = computed(() => {
    const isFreeTier = this.organization()?.productTierType === ProductTierType.Free;
    const shouldHideFree = !this.showFree();
    const hasNoPaymentSource = !this.paymentMethod();

    return isFreeTier && shouldHideFree && hasNoPaymentSource;
  });

  readonly selectedPlanInterval = computed(() => {
    if (this.isSubscriptionCanceled()) {
      return this.currentPlan()?.isAnnual ? "year" : "month";
    }
    return this.selectedPlan()?.isAnnual ? "year" : "month";
  });

  readonly selectableProducts = computed(() => {
    if (this.isSubscriptionCanceled()) {
      const resubPlan = this.reSubscribablePlan();
      return resubPlan ? [resubPlan] : [];
    }

    const pmPlans = this.passwordManagerPlans() ?? [];
    const familyPlanType = this._familyPlan();

    if (this.acceptingSponsorship()) {
      const familyPlan = pmPlans.find((plan) => plan.type === familyPlanType);
      if (familyPlan) {
        this.discount.set(familyPlan.PasswordManager.basePrice);
        return [familyPlan];
      }
      return [];
    }

    const businessOwnedIsChecked = this.formValues()?.businessOwned ?? false;
    const selectedInterval = this.selectedInterval();
    const cp = this.currentPlan();
    const org = this.organization();

    const result = pmPlans.filter(
      (plan) =>
        plan.type !== PlanType.Custom &&
        (!businessOwnedIsChecked || plan.canBeUsedByBusiness) &&
        (this.showFree() || plan.productTier !== ProductTierType.Free) &&
        (plan.productTier === ProductTierType.Free ||
          plan.productTier === ProductTierType.TeamsStarter ||
          (selectedInterval === PlanInterval.Annually && plan.isAnnual) ||
          (selectedInterval === PlanInterval.Monthly && !plan.isAnnual)) &&
        (plan.productTier !== ProductTierType.Families || plan.type === familyPlanType) &&
        (!cp || cp.upgradeSortOrder < plan.upgradeSortOrder) &&
        this.planIsEnabled(plan),
    );

    if (
      cp?.productTier === ProductTierType.Free &&
      selectedInterval === PlanInterval.Monthly &&
      !org?.useSecretsManager
    ) {
      const familyPlan = pmPlans.find((plan) => plan.productTier == ProductTierType.Families);
      if (familyPlan) {
        result.push(familyPlan);
      }
    }

    if (org?.useSecretsManager && cp?.productTier === ProductTierType.Free) {
      const familyPlanIndex = result.findIndex(
        (plan) => plan.productTier === ProductTierType.Families,
      );

      if (familyPlanIndex !== -1) {
        result.splice(familyPlanIndex, 1);
      }
    }

    if (cp && cp.productTier !== ProductTierType.Free) {
      result.push(cp);
    }

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  });

  readonly selectablePlans = computed(() => {
    const selectedProductTierType = this.formValues()?.productTier;
    const result =
      this.passwordManagerPlans()?.filter(
        (plan) => plan.productTier === selectedProductTierType && this.planIsEnabled(plan),
      ) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);
    return result;
  });

  readonly teamsStarterPlanIsAvailable = computed(() =>
    this.selectablePlans().some((plan) => plan.type === PlanType.TeamsStarter),
  );

  readonly supportsTaxId = computed(() => {
    return this.formValues()?.productTier !== ProductTierType.Families;
  });

  readonly cartData = computed<Cart | null>(() => {
    const plan = this.selectedPlan();
    if (!plan) {
      return null;
    }

    const cadence = plan.isAnnual ? "annually" : "monthly";

    // Password Manager seats
    const pmSeats = this.passwordManagerSeats();
    const pmSeatCost = plan.PasswordManager.basePrice
      ? plan.isAnnual
        ? plan.PasswordManager.basePrice / 12
        : plan.PasswordManager.basePrice
      : plan.PasswordManager.seatPrice;

    const cart: Cart = {
      passwordManager: {
        seats: {
          translationKey: "members",
          quantity: pmSeats,
          cost: pmSeatCost,
        },
      },
      cadence,
      estimatedTax: this.estimatedTax(),
    };

    // Additional storage
    const storage = this.storageGb();
    if (plan.PasswordManager.hasAdditionalStorageOption && storage > 0) {
      cart.passwordManager.additionalStorage = {
        translationKey: "additionalStorageGbMessage",
        translationParams: [storage],
        quantity: storage,
        cost: plan.PasswordManager.additionalStoragePricePerGb,
      };
    }

    // Secrets Manager
    if (this.organization()?.useSecretsManager && plan.SecretsManager) {
      const smSeats = this.sub()?.smSeats || 0;
      const smSeatCost = plan.SecretsManager.basePrice
        ? plan.isAnnual
          ? plan.SecretsManager.basePrice / 12
          : plan.SecretsManager.basePrice
        : plan.SecretsManager.seatPrice;

      cart.secretsManager = {
        seats: {
          translationKey: "members",
          quantity: smSeats,
          cost: smSeatCost,
        },
      };

      // Additional service accounts
      const addlSvcAccts = this.additionalServiceAccount();
      if (plan.SecretsManager.hasAdditionalServiceAccountOption && addlSvcAccts > 0) {
        cart.secretsManager.additionalServiceAccounts = {
          translationKey: "serviceAccounts",
          quantity: addlSvcAccts,
          cost: plan.SecretsManager.additionalPricePerServiceAccount,
        };
      }
    }

    // Cart-level discount
    const discountPct = this.discountPercentageFromSub();
    if (discountPct > 0 && !this.isSecretsManagerTrial()) {
      cart.discounts = [
        {
          type: DiscountTypes.PercentOff,
          value: discountPct,
        },
      ];
    }

    return cart;
  });

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: ChangePlanDialogParams,
    private dialogRef: DialogRef<ChangePlanDialogResultType>,
    private toastService: ToastService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private accountService: AccountService,
    private billingNotificationService: BillingNotificationService,
    private subscriberBillingClient: SubscriberBillingClient,
    private previewInvoiceClient: PreviewInvoiceClient,
    private organizationWarningsService: OrganizationWarningsService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.dialogParams.organizationId) {
      this.currentPlanName.set(this.resolvePlanName(this.dialogParams.productTierType));
      const subscription =
        this.dialogParams.subscription ??
        (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
      this.sub.set(subscription);
      this.dialogHeaderName.set(this.resolveHeaderName(subscription));
      this.organizationId.set(this.dialogParams.organizationId);
      this.currentPlan.set(subscription?.plan);
      this.selectedPlan.set(subscription?.plan);
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const org = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId())),
      );
      this.organization.set(org);
      if (subscription?.subscription?.status !== "canceled") {
        try {
          const subscriber: BitwardenSubscriber = { type: "organization", data: org };
          const [paymentMethod, billingAddress] = await Promise.all([
            this.subscriberBillingClient.getPaymentMethod(subscriber),
            this.subscriberBillingClient.getBillingAddress(subscriber),
          ]);

          this.paymentMethod.set(paymentMethod);
          this.billingAddress.set(billingAddress);
        } catch (error) {
          this.billingNotificationService.handleError(error);
        }
      }
    }

    if (!this.selfHosted()) {
      const plansList = await this.apiService.getPlans();
      this.plans.set(plansList);
      this.passwordManagerPlans.set(plansList.data.filter((plan) => !!plan.PasswordManager));
      this.secretsManagerPlans.set(plansList.data.filter((plan) => !!plan.SecretsManager));

      const productTier = this.formValues()?.productTier;
      if (productTier === ProductTierType.Enterprise || productTier === ProductTierType.Teams) {
        this.formGroup.controls.businessOwned.setValue(true);
      }
    }

    this._familyPlan.set(PlanType.FamiliesAnnually);
    const cp = this.currentPlan();
    if (cp && cp.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans().find((plan) =>
        cp.productTier === ProductTierType.Free
          ? plan.type === this._familyPlan()
          : plan.upgradeSortOrder == cp.upgradeSortOrder + 1,
      );

      if (upgradedPlan) {
        this.formGroup.controls.plan.setValue(upgradedPlan.type);
        this.formGroup.controls.productTier.setValue(upgradedPlan.productTier);
      }
    }
    this.upgradeFlowPrefillForm();

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => singleOrganizationPolicyApplies$(userId, this.policyService)),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.singleOrgPolicyAppliesToActiveUser.set(policyAppliesToActiveUser);
      });

    if (!this.selfHosted()) {
      this.changedProduct();
    }

    this.planCards.set([
      {
        name: this.i18nService.t("planNameTeams"),
        selected: true,
      },
      {
        name: this.i18nService.t("planNameEnterprise"),
        selected: false,
      },
    ]);
    this.discountPercentageFromSub.set(
      this.isSecretsManagerTrial() ? 0 : (this.sub()?.customerDiscount?.percentOff ?? 0),
    );

    await this.setInitialPlanSelection();
    if (!this.isSubscriptionCanceled()) {
      await this.refreshSalesTax();
    }

    combineLatest([
      this.billingFormGroup.controls.billingAddress.controls.country.valueChanges,
      this.billingFormGroup.controls.billingAddress.controls.postalCode.valueChanges,
      this.billingFormGroup.controls.billingAddress.controls.taxId.valueChanges,
    ])
      .pipe(
        debounceTime(1000),
        switchMap(async () => await this.refreshSalesTax()),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.loading.set(false);
  }

  resolveHeaderName(subscription: OrganizationSubscriptionResponse): string {
    if (subscription.subscription != null) {
      const isCanceled =
        subscription.subscription.cancelled &&
        this.sub()?.plan.productTier !== ProductTierType.Free;
      this.isSubscriptionCanceled.set(isCanceled);
      if (isCanceled) {
        return this.i18nService.t("restartSubscription");
      }
    }

    return this.i18nService.t(
      "upgradeFreeOrganization",
      this.resolvePlanName(this.dialogParams.productTierType),
    );
  }

  async setInitialPlanSelection() {
    this.focusedIndex.set(this.selectableProducts().length - 1);
    if (!this.isSubscriptionCanceled()) {
      await this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
    } else {
      await this.selectPlan(this.reSubscribablePlan());
    }
  }

  getPlanByType(productTier: ProductTierType) {
    return this.selectableProducts().find((product) => product.productTier === productTier);
  }

  isSecretsManagerTrial(): boolean {
    const subscription = this.sub();
    return (
      subscription?.subscription?.items?.some((item) =>
        subscription?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  async planTypeChanged() {
    await this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
  }

  async updateInterval(event: number) {
    this.selectedInterval.set(event);
    await this.planTypeChanged();
  }

  protected getPlanIntervals() {
    return [
      {
        name: PlanInterval[PlanInterval.Annually],
        value: PlanInterval.Annually,
      },
      {
        name: PlanInterval[PlanInterval.Monthly],
        value: PlanInterval.Monthly,
      },
    ];
  }

  protected getPlanCardContainerClasses(plan: PlanResponse) {
    let cardState: PlanCardState;

    // Determine card state without side effects
    if (plan == this.currentPlan()) {
      cardState = PlanCardState.Disabled;
    } else if (plan == this.selectedPlan()) {
      cardState = PlanCardState.Selected;
    } else if (
      this.selectedInterval() === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      cardState = PlanCardState.Disabled;
    } else {
      cardState = PlanCardState.NotSelected;
    }

    switch (cardState) {
      case PlanCardState.Selected: {
        return [
          "tw-cursor-pointer",
          "tw-block",
          "tw-rounded",
          "tw-border",
          "tw-border-solid",
          "tw-border-primary-600",
          "hover:tw-border-primary-700",
          "tw-border-2",
          "!tw-border-primary-700",
          "tw-rounded-lg",
        ];
      }
      case PlanCardState.NotSelected: {
        return [
          "tw-cursor-pointer",
          "tw-block",
          "tw-rounded",
          "tw-border",
          "tw-border-solid",
          "tw-border-secondary-300",
          "hover:tw-border-text-main",
          "focus:tw-border-2",
          "focus:tw-border-primary-700",
        ];
      }
      case PlanCardState.Disabled: {
        if (this.isSubscriptionCanceled()) {
          return [
            "tw-cursor-not-allowed",
            "tw-bg-secondary-100",
            "tw-font-normal",
            "tw-bg-blur",
            "tw-text-muted",
            "tw-block",
            "tw-rounded",
            "tw-w-80",
          ];
        }

        return [
          "tw-cursor-not-allowed",
          "tw-bg-secondary-100",
          "tw-font-normal",
          "tw-bg-blur",
          "tw-text-muted",
          "tw-block",
          "tw-rounded",
        ];
      }
    }
  }

  protected async selectPlan(plan: PlanResponse) {
    if (
      this.selectedInterval() === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      return;
    }

    if (plan === this.currentPlan() && !this.isSubscriptionCanceled()) {
      return;
    }
    this.selectedPlan.set(plan);
    this.formGroup.patchValue({ productTier: plan.productTier });

    try {
      await this.refreshSalesTax();
    } catch {
      this.estimatedTax.set(0);
    }
  }

  readonly reSubscribablePlan = computed(() => {
    const cp = this.currentPlan();
    if (!cp) {
      throw new Error(
        "Current plan must be set to find the re-subscribable plan for a cancelled subscription.",
      );
    }
    if (!cp.disabled) {
      return cp;
    }
    return (
      this.passwordManagerPlans().find(
        (plan) =>
          plan.productTier === cp.productTier && plan.isAnnual === cp.isAnnual && !plan.disabled,
      ) ?? cp
    );
  });

  readonly storageGb = computed(() => {
    const plan = this.selectedPlan();
    return Math.max(
      0,
      (this.sub()?.maxStorageGb ?? 0) - (plan?.PasswordManager.baseStorageGb ?? 0),
    );
  });

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  passwordManagerSeatTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption || this.isSecretsManagerTrial()) {
      return 0;
    }

    return plan.PasswordManager.seatPrice * Math.abs(this.sub()?.seats || 0);
  }

  secretsManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.SecretsManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.SecretsManager.seatPrice * Math.abs(seats || 0);
  }

  additionalStorageTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalStorageOption) {
      return 0;
    }

    return plan.PasswordManager.additionalStoragePricePerGb * this.storageGb();
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse) {
    return selectedPlan.PasswordManager.additionalStoragePricePerGb;
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    const addlSvcAccts = this.additionalServiceAccount();
    if (!plan.SecretsManager.hasAdditionalServiceAccountOption || addlSvcAccts == 0) {
      return 0;
    }

    return plan.SecretsManager.additionalPricePerServiceAccount * addlSvcAccts;
  }

  readonly passwordManagerSubtotal = computed(() => {
    const plan = this.selectedPlan();
    if (!plan || !plan.PasswordManager) {
      return 0;
    }

    let subTotal = plan.PasswordManager.basePrice;
    if (plan.PasswordManager.hasAdditionalSeatsOption) {
      subTotal += this.passwordManagerSeatTotal(plan);
    }
    if (plan.PasswordManager.hasPremiumAccessOption) {
      subTotal += plan.PasswordManager.premiumAccessOptionPrice;
    }
    if (plan.PasswordManager.hasAdditionalStorageOption) {
      subTotal += this.additionalStorageTotal(plan);
    }
    return subTotal - this.discount();
  });

  readonly secretsManagerSubtotalValue = computed(() => {
    const plan = this.selectedPlan();
    if (!plan || !plan.SecretsManager) {
      return this.secretsManagerTotal() || 0;
    }

    if (this.secretsManagerTotal()) {
      return this.secretsManagerTotal();
    }

    const total =
      plan.SecretsManager.basePrice +
      this.secretsManagerSeatTotal(plan, this.sub()?.smSeats) +
      this.additionalServiceAccountTotal(plan);
    return total;
  });

  secretsManagerSubtotal() {
    return this.secretsManagerSubtotalValue();
  }

  readonly passwordManagerSeats = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) {
      return 0;
    }

    if (plan.productTier === ProductTierType.Families) {
      return plan.PasswordManager.baseSeats;
    }
    return this.sub()?.seats;
  });

  readonly total = computed(() => {
    const org = this.organization();
    const plan = this.selectedPlan();
    if (!org || !plan) {
      return 0;
    }

    if (org.useSecretsManager) {
      return this.passwordManagerSubtotal() + this.secretsManagerSubtotal() + this.estimatedTax();
    }
    return this.passwordManagerSubtotal() + this.estimatedTax();
  });

  readonly additionalServiceAccount = computed(() => {
    const cp = this.currentPlan();
    if (!cp || !cp.SecretsManager) {
      return 0;
    }

    const baseServiceAccount = cp.SecretsManager?.baseServiceAccount || 0;
    const usedServiceAccounts = this.sub()?.smServiceAccounts || 0;

    const additionalServiceAccounts = baseServiceAccount - usedServiceAccounts;

    return additionalServiceAccounts <= 0 ? Math.abs(additionalServiceAccounts) : 0;
  });

  changedProduct() {
    const selectedPlan = this.selectablePlans()[0];

    this.setPlanType(selectedPlan.type);
    this.handlePremiumAddonAccess(selectedPlan.PasswordManager.hasPremiumAccessOption);
    this.handleAdditionalSeats(selectedPlan.PasswordManager.hasAdditionalSeatsOption);
  }

  setPlanType(planType: PlanType) {
    this.formGroup.controls.plan.setValue(planType);
  }

  handlePremiumAddonAccess(hasPremiumAccessOption: boolean) {
    this.formGroup.controls.premiumAccessAddon.setValue(!hasPremiumAccessOption);
  }

  handleAdditionalSeats(selectedPlanHasAdditionalSeatsOption: boolean) {
    if (!selectedPlanHasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(0);
      return;
    }

    const cp = this.currentPlan();
    if (cp && !cp.PasswordManager.hasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(cp.PasswordManager.baseSeats);
      return;
    }

    const org = this.organization();
    if (org) {
      this.formGroup.controls.additionalSeats.setValue(org.seats);
      return;
    }

    this.formGroup.controls.additionalSeats.setValue(1);
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    this.billingFormGroup.markAllAsTouched();
    if (this.formGroup.invalid || (this.billingFormGroup.invalid && !this.paymentMethod())) {
      return;
    }

    const doSubmit = async (): Promise<string> => {
      let orgId: string;
      const sub = this.sub()?.subscription;
      const isCanceled = sub?.status === "canceled";
      const org = this.organization();
      const isCancelledDowngradedToFreeOrg =
        sub?.cancelled && org.productTierType === ProductTierType.Free;

      if (isCanceled || isCancelledDowngradedToFreeOrg) {
        await this.restartSubscription();
        orgId = this.organizationId();
      } else {
        orgId = await this.updateOrganization();
      }
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.isSubscriptionCanceled()
          ? this.i18nService.t("restartOrganizationSubscription")
          : this.i18nService.t("organizationUpgraded"),
      });

      await this.syncService.fullSync(true);

      if (!this.acceptingSponsorship() && !this.isInTrialFlow()) {
        await this.router.navigate(["/organizations/" + orgId + "/billing/subscription"]);
      }

      if (this.isInTrialFlow()) {
        this.onTrialBillingSuccess.emit({
          orgId: orgId,
          subLabelText: this.billingSubLabelText(),
        });
      }

      return orgId;
    };

    const promise = doSubmit();
    this.formPromise.set(promise);
    const organizationId = await promise;
    this.onSuccess.emit({ organizationId: organizationId });
    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId });
    await this.dialogRef.close();
  };

  private async restartSubscription() {
    const paymentMethod = await this.enterPaymentMethodComponent()?.tokenize();
    const billingAddress = getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress);
    await this.subscriberBillingClient.restartSubscription(
      { type: "organization", data: this.organization() },
      paymentMethod,
      billingAddress,
    );
    this.organizationWarningsService.refreshInactiveSubscriptionWarning();
  }

  private async updateOrganization() {
    const request = new OrganizationUpgradeRequest();
    const plan = this.selectedPlan();
    const subscription = this.sub();
    if (plan.productTier !== ProductTierType.Families) {
      request.additionalSeats = subscription?.seats;
    }
    if (subscription?.maxStorageGb > plan.PasswordManager.baseStorageGb) {
      request.additionalStorageGb = subscription?.maxStorageGb - plan.PasswordManager.baseStorageGb;
    }
    request.premiumAccessAddon =
      plan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value;
    request.planType = plan.type;
    if (this.showPayment()) {
      request.billingAddressCountry = this.billingFormGroup.controls.billingAddress.value.country;
      request.billingAddressPostalCode =
        this.billingFormGroup.controls.billingAddress.value.postalCode;
    }

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.upgradeRequiresPaymentMethod() || this.showPayment() || !this.paymentMethod()) {
      const paymentMethod = await this.enterPaymentMethodComponent()?.tokenize();
      const billingAddress = getBillingAddressFromForm(
        this.billingFormGroup.controls.billingAddress,
      );

      const subscriber: BitwardenSubscriber = { type: "organization", data: this.organization() };
      // These need to be synchronous so one of them can create the Customer in the case we're upgrading from Free.
      await this.subscriberBillingClient.updateBillingAddress(subscriber, billingAddress);
      await this.subscriberBillingClient.updatePaymentMethod(subscriber, paymentMethod, null);
    }

    // Backfill pub/priv key if necessary
    const org = this.organization();
    if (!org.hasPublicAndPrivateKeys) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const orgShareKey = await firstValueFrom(
        this.keyService
          .orgKeys$(userId)
          .pipe(map((orgKeys) => orgKeys?.[this.organizationId() as OrganizationId] ?? null)),
      );
      const orgKeys = await this.keyService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    await this.organizationApiService.upgrade(this.organizationId(), request);
    return this.organizationId();
  }

  private billingSubLabelText(): string {
    const selectedPlan = this.selectedPlan();
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

  private buildSecretsManagerRequest(request: OrganizationUpgradeRequest): void {
    const org = this.organization();
    request.useSecretsManager = org.useSecretsManager;
    if (!org.useSecretsManager) {
      return;
    }

    const plan = this.selectedPlan();
    const cp = this.currentPlan();
    if (plan.SecretsManager.hasAdditionalSeatsOption && cp.productTier === ProductTierType.Free) {
      request.additionalSmSeats = org.seats;
    } else {
      request.additionalSmSeats = this.sub()?.smSeats;
      request.additionalServiceAccounts = this.additionalServiceAccount();
    }
  }

  private upgradeFlowPrefillForm() {
    if (this.acceptingSponsorship()) {
      this.formGroup.controls.productTier.setValue(ProductTierType.Families);
      this.changedProduct();
      return;
    }

    const cp = this.currentPlan();
    if (cp && cp.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans().find((plan) => {
        if (cp.productTier === ProductTierType.Free) {
          return plan.type === this._familyPlan();
        }

        if (cp.productTier === ProductTierType.Families && !this.teamsStarterPlanIsAvailable()) {
          return plan.type === PlanType.TeamsAnnually;
        }

        return plan.upgradeSortOrder === cp.upgradeSortOrder + 1;
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

  toggleShowPayment() {
    this.showPayment.set(true);
  }

  toggleTotalOpened() {
    this.totalOpened.set(!this.totalOpened());
  }

  calculateTotalAppliedDiscount(total: number) {
    return total * (this.discountPercentageFromSub() / 100);
  }

  resolvePlanName(productTier: ProductTierType) {
    switch (productTier) {
      case ProductTierType.Enterprise:
        return this.i18nService.t("planNameEnterprise");
      case ProductTierType.Free:
        return this.i18nService.t("planNameFree");
      case ProductTierType.Families:
        return this.i18nService.t("planNameFamilies");
      case ProductTierType.Teams:
        return this.i18nService.t("planNameTeams");
      case ProductTierType.TeamsStarter:
        return this.i18nService.t("planNameTeamsStarter");
    }
  }

  onKeydown(event: KeyboardEvent, index: number) {
    const cardElements = Array.from(document.querySelectorAll(".product-card")) as HTMLElement[];
    let newIndex = index;
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;

    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      do {
        newIndex = (newIndex + direction + cardElements.length) % cardElements.length;
      } while (this.isCardDisabled(newIndex) && newIndex !== index);

      event.preventDefault();

      setTimeout(() => {
        const card = cardElements[newIndex];
        if (
          !(
            card.classList.contains("tw-bg-secondary-100") &&
            card.classList.contains("tw-text-muted")
          )
        ) {
          card?.focus();
        }
      }, 0);
    }
  }

  async onFocus(index: number) {
    this.focusedIndex.set(index);
    await this.selectPlan(this.selectableProducts()[index]);
  }

  isCardDisabled(index: number): boolean {
    const card = this.selectableProducts()[index];
    const currentPlan = this.currentPlan();

    // Card is disabled if it's the current plan or if it's a family plan with monthly interval
    if (card === currentPlan) {
      return true;
    }

    if (
      this.selectedInterval() === PlanInterval.Monthly &&
      card.productTier === ProductTierType.Families
    ) {
      return true;
    }

    return false;
  }

  private async refreshSalesTax(): Promise<void> {
    if (this.billingFormGroup.controls.billingAddress.invalid && !this.billingAddress()) {
      return;
    }

    const getPlanFromLegacyEnum = (planType: PlanType): OrganizationSubscriptionPlan => {
      switch (planType) {
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
      }
    };

    const billingAddress = this.billingFormGroup.controls.billingAddress.valid
      ? getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress)
      : this.billingAddress();

    const taxAmounts =
      await this.previewInvoiceClient.previewTaxForOrganizationSubscriptionPlanChange(
        this.organizationId(),
        getPlanFromLegacyEnum(this.selectedPlan().type),
        billingAddress,
      );

    this.estimatedTax.set(taxAmounts.tax);
  }

  protected canUpdatePaymentInformation(): boolean {
    return (
      this.upgradeRequiresPaymentMethod() ||
      this.showPayment() ||
      !this.paymentMethod() ||
      this.isSubscriptionCanceled()
    );
  }

  readonly submitButtonLabel = computed(() => {
    const org = this.organization();
    const subscription = this.sub();
    if (
      org &&
      subscription &&
      org.productTierType !== ProductTierType.Free &&
      subscription.subscription?.status === "canceled"
    ) {
      return this.i18nService.t("restart");
    } else {
      return this.i18nService.t("upgrade");
    }
  });

  getCardBrandIcon = () => getCardBrandIcon(this.paymentMethod());
}
