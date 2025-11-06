// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Subject, switchMap, takeUntil } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
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
import {
  OrganizationSubscriptionPlan,
  SubscriberBillingClient,
  TaxClient,
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
  ],
  providers: [SubscriberBillingClient, TaxClient],
})
export class ChangePlanDialogComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent: EnterPaymentMethodComponent;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() acceptingSponsorship = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationId: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showFree = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showCancel = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get productTier(): ProductTierType {
    return this._productTier;
  }

  set productTier(product: ProductTierType) {
    this._productTier = product;
    this.formGroup?.controls?.productTier?.setValue(product);
  }

  protected estimatedTax: number = 0;
  private _productTier = ProductTierType.Free;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get plan(): PlanType {
    return this._plan;
  }

  set plan(plan: PlanType) {
    this._plan = plan;
    this.formGroup?.controls?.plan?.setValue(plan);
  }

  private _plan = PlanType.Free;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() providerId?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onCanceled = new EventEmitter<void>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onTrialBillingSuccess = new EventEmitter();

  protected discountPercentageFromSub: number;
  protected loading = true;
  protected planCards: PlanCard[];
  protected ResultType = ChangePlanDialogResultType;

  selfHosted = false;
  productTypes = ProductTierType;
  formPromise: Promise<string>;
  singleOrgPolicyAppliesToActiveUser = false;
  isInTrialFlow = false;
  discount = 0;

  formGroup = this.formBuilder.group({
    name: [""],
    billingEmail: ["", [Validators.email]],
    businessOwned: [false],
    premiumAccessAddon: [false],
    additionalSeats: [0, [Validators.min(0), Validators.max(100000)]],
    clientOwnerEmail: ["", [Validators.email]],
    plan: [this.plan],
    productTier: [this.productTier],
  });

  billingFormGroup = this.formBuilder.group({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  planType: string;
  selectedPlan: PlanResponse;
  selectedInterval: number = 1;
  planIntervals = PlanInterval;
  passwordManagerPlans: PlanResponse[];
  secretsManagerPlans: PlanResponse[];
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  dialogHeaderName: string;
  currentPlanName: string;
  showPayment: boolean = false;
  totalOpened: boolean = false;
  currentPlan: PlanResponse;
  isCardStateDisabled = false;
  focusedIndex: number | null = null;
  plans: ListResponse<PlanResponse>;
  isSubscriptionCanceled: boolean = false;
  secretsManagerTotal: number;

  paymentMethod: MaskedPaymentMethod | null;
  billingAddress: BillingAddress | null;

  private destroy$ = new Subject<void>();

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
    private taxClient: TaxClient,
    private organizationWarningsService: OrganizationWarningsService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.dialogParams.organizationId) {
      this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
      this.sub =
        this.dialogParams.subscription ??
        (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
      this.dialogHeaderName = this.resolveHeaderName(this.sub);
      this.organizationId = this.dialogParams.organizationId;
      this.currentPlan = this.sub?.plan;
      this.selectedPlan = this.sub?.plan;
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );
      if (this.sub?.subscription?.status !== "canceled") {
        try {
          const subscriber: BitwardenSubscriber = { type: "organization", data: this.organization };
          const [paymentMethod, billingAddress] = await Promise.all([
            this.subscriberBillingClient.getPaymentMethod(subscriber),
            this.subscriberBillingClient.getBillingAddress(subscriber),
          ]);

          this.paymentMethod = paymentMethod;
          this.billingAddress = billingAddress;
        } catch (error) {
          this.billingNotificationService.handleError(error);
        }
      }
    }

    if (!this.selfHosted) {
      this.plans = await this.apiService.getPlans();
      this.passwordManagerPlans = this.plans.data.filter((plan) => !!plan.PasswordManager);
      this.secretsManagerPlans = this.plans.data.filter((plan) => !!plan.SecretsManager);

      if (
        this.productTier === ProductTierType.Enterprise ||
        this.productTier === ProductTierType.Teams
      ) {
        this.formGroup.controls.businessOwned.setValue(true);
      }
    }

    if (this.currentPlan && this.currentPlan.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) =>
        this.currentPlan.productTier === ProductTierType.Free
          ? plan.type === PlanType.FamiliesAnnually
          : plan.upgradeSortOrder == this.currentPlan.upgradeSortOrder + 1,
      );

      this.plan = upgradedPlan.type;
      this.productTier = upgradedPlan.productTier;
    }
    this.upgradeFlowPrefillForm();

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

    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.planCards = [
      {
        name: this.i18nService.t("planNameTeams"),
        selected: true,
      },
      {
        name: this.i18nService.t("planNameEnterprise"),
        selected: false,
      },
    ];
    this.discountPercentageFromSub = this.isSecretsManagerTrial()
      ? 0
      : (this.sub?.customerDiscount?.percentOff ?? 0);

    await this.setInitialPlanSelection();
    if (!this.isSubscriptionCanceled) {
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

    this.loading = false;
  }

  resolveHeaderName(subscription: OrganizationSubscriptionResponse): string {
    if (subscription.subscription != null) {
      this.isSubscriptionCanceled =
        subscription.subscription.cancelled && this.sub?.plan.productTier !== ProductTierType.Free;
      if (this.isSubscriptionCanceled) {
        return this.i18nService.t("restartSubscription");
      }
    }

    return this.i18nService.t(
      "upgradeFreeOrganization",
      this.resolvePlanName(this.dialogParams.productTierType),
    );
  }

  async setInitialPlanSelection() {
    this.focusedIndex = this.selectableProducts.length - 1;
    if (!this.isSubscriptionCanceled) {
      await this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
    }
  }

  getPlanByType(productTier: ProductTierType) {
    return this.selectableProducts.find((product) => product.productTier === productTier);
  }

  isSecretsManagerTrial(): boolean {
    return (
      this.sub?.subscription?.items?.some((item) =>
        this.sub?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  async planTypeChanged() {
    await this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
  }

  async updateInterval(event: number) {
    this.selectedInterval = event;
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

  optimizedNgForRender(index: number) {
    return index;
  }

  protected getPlanCardContainerClasses(plan: PlanResponse, index: number) {
    let cardState: PlanCardState;

    if (plan == this.currentPlan) {
      cardState = PlanCardState.Disabled;
      this.isCardStateDisabled = true;
      this.focusedIndex = index;
    } else if (plan == this.selectedPlan) {
      cardState = PlanCardState.Selected;
      this.isCardStateDisabled = false;
      this.focusedIndex = index;
    } else if (
      this.selectedInterval === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      cardState = PlanCardState.Disabled;
      this.isCardStateDisabled = true;
      this.focusedIndex = this.selectableProducts.length - 1;
    } else {
      cardState = PlanCardState.NotSelected;
      this.isCardStateDisabled = false;
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
        if (this.isSubscriptionCanceled) {
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
      this.selectedInterval === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      return;
    }

    if (plan === this.currentPlan && !this.isSubscriptionCanceled) {
      return;
    }
    this.selectedPlan = plan;
    this.formGroup.patchValue({ productTier: plan.productTier });

    try {
      await this.refreshSalesTax();
    } catch {
      this.estimatedTax = 0;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get upgradeRequiresPaymentMethod() {
    const isFreeTier = this.organization?.productTierType === ProductTierType.Free;
    const shouldHideFree = !this.showFree;
    const hasNoPaymentSource = !this.paymentMethod;

    return isFreeTier && shouldHideFree && hasNoPaymentSource;
  }

  get selectedPlanInterval() {
    if (this.isSubscriptionCanceled) {
      return this.currentPlan.isAnnual ? "year" : "month";
    }
    return this.selectedPlan.isAnnual ? "year" : "month";
  }

  get selectableProducts() {
    if (this.isSubscriptionCanceled) {
      // Return only the current plan if the subscription is canceled
      return [this.currentPlan];
    }

    if (this.acceptingSponsorship) {
      const familyPlan = this.passwordManagerPlans.find(
        (plan) => plan.type === PlanType.FamiliesAnnually,
      );
      this.discount = familyPlan.PasswordManager.basePrice;
      return [familyPlan];
    }

    const businessOwnedIsChecked = this.formGroup.controls.businessOwned.value;

    const result = this.passwordManagerPlans.filter(
      (plan) =>
        plan.type !== PlanType.Custom &&
        (!businessOwnedIsChecked || plan.canBeUsedByBusiness) &&
        (this.showFree || plan.productTier !== ProductTierType.Free) &&
        (plan.productTier === ProductTierType.Free ||
          plan.productTier === ProductTierType.TeamsStarter ||
          (this.selectedInterval === PlanInterval.Annually && plan.isAnnual) ||
          (this.selectedInterval === PlanInterval.Monthly && !plan.isAnnual)) &&
        (!this.currentPlan || this.currentPlan.upgradeSortOrder < plan.upgradeSortOrder) &&
        this.planIsEnabled(plan),
    );

    if (
      this.currentPlan.productTier === ProductTierType.Free &&
      this.selectedInterval === PlanInterval.Monthly &&
      !this.organization.useSecretsManager
    ) {
      const familyPlan = this.passwordManagerPlans.find(
        (plan) => plan.productTier == ProductTierType.Families,
      );
      result.push(familyPlan);
    }

    if (
      this.organization.useSecretsManager &&
      this.currentPlan.productTier === ProductTierType.Free
    ) {
      const familyPlanIndex = result.findIndex(
        (plan) => plan.productTier === ProductTierType.Families,
      );

      if (familyPlanIndex !== -1) {
        result.splice(familyPlanIndex, 1);
      }
    }

    if (this.currentPlan.productTier !== ProductTierType.Free) {
      result.push(this.currentPlan);
    }

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  }

  get selectablePlans() {
    const selectedProductTierType = this.formGroup.controls.productTier.value;
    const result =
      this.passwordManagerPlans?.filter(
        (plan) => plan.productTier === selectedProductTierType && this.planIsEnabled(plan),
      ) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);
    return result;
  }

  get storageGb() {
    return this.sub?.maxStorageGb ? this.sub?.maxStorageGb - 1 : 0;
  }

  passwordManagerSeatTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption || this.isSecretsManagerTrial()) {
      return 0;
    }

    return plan.PasswordManager.seatPrice * Math.abs(this.sub?.seats || 0);
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

    return (
      plan.PasswordManager.additionalStoragePricePerGb *
      // TODO: Eslint upgrade. Please resolve this  since the null check does nothing
      // eslint-disable-next-line no-constant-binary-expression
      Math.abs(this.sub?.maxStorageGb ? this.sub?.maxStorageGb - 1 : 0 || 0)
    );
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse) {
    return selectedPlan.PasswordManager.additionalStoragePricePerGb;
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    if (
      !plan.SecretsManager.hasAdditionalServiceAccountOption ||
      this.additionalServiceAccount == 0
    ) {
      return 0;
    }

    return plan.SecretsManager.additionalPricePerServiceAccount * this.additionalServiceAccount;
  }

  get passwordManagerSubtotal() {
    if (!this.selectedPlan || !this.selectedPlan.PasswordManager) {
      return 0;
    }

    let subTotal = this.selectedPlan.PasswordManager.basePrice;
    if (this.selectedPlan.PasswordManager.hasAdditionalSeatsOption) {
      subTotal += this.passwordManagerSeatTotal(this.selectedPlan);
    }
    if (this.selectedPlan.PasswordManager.hasPremiumAccessOption) {
      subTotal += this.selectedPlan.PasswordManager.premiumAccessOptionPrice;
    }
    if (this.selectedPlan.PasswordManager.hasAdditionalStorageOption) {
      subTotal += this.additionalStorageTotal(this.selectedPlan);
    }
    return subTotal - this.discount;
  }

  secretsManagerSubtotal() {
    const plan = this.selectedPlan;
    if (!plan || !plan.SecretsManager) {
      return this.secretsManagerTotal || 0;
    }

    if (this.secretsManagerTotal) {
      return this.secretsManagerTotal;
    }

    this.secretsManagerTotal =
      plan.SecretsManager.basePrice +
      this.secretsManagerSeatTotal(plan, this.sub?.smSeats) +
      this.additionalServiceAccountTotal(plan);
    return this.secretsManagerTotal;
  }

  get passwordManagerSeats() {
    if (!this.selectedPlan) {
      return 0;
    }

    if (this.selectedPlan.productTier === ProductTierType.Families) {
      return this.selectedPlan.PasswordManager.baseSeats;
    }
    return this.sub?.seats;
  }

  get total() {
    if (!this.organization || !this.selectedPlan) {
      return 0;
    }

    if (this.organization.useSecretsManager) {
      return this.passwordManagerSubtotal + this.secretsManagerSubtotal() + this.estimatedTax;
    }
    return this.passwordManagerSubtotal + this.estimatedTax;
  }

  get teamsStarterPlanIsAvailable() {
    return this.selectablePlans.some((plan) => plan.type === PlanType.TeamsStarter);
  }

  get additionalServiceAccount() {
    if (!this.currentPlan || !this.currentPlan.SecretsManager) {
      return 0;
    }

    const baseServiceAccount = this.currentPlan.SecretsManager?.baseServiceAccount || 0;
    const usedServiceAccounts = this.sub?.smServiceAccounts || 0;

    const additionalServiceAccounts = baseServiceAccount - usedServiceAccounts;

    return additionalServiceAccounts <= 0 ? Math.abs(additionalServiceAccounts) : 0;
  }

  changedProduct() {
    const selectedPlan = this.selectablePlans[0];

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

    if (this.currentPlan && !this.currentPlan.PasswordManager.hasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(this.currentPlan.PasswordManager.baseSeats);
      return;
    }

    if (this.organization) {
      this.formGroup.controls.additionalSeats.setValue(this.organization.seats);
      return;
    }

    this.formGroup.controls.additionalSeats.setValue(1);
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    this.billingFormGroup.markAllAsTouched();
    if (this.formGroup.invalid || (this.billingFormGroup.invalid && !this.paymentMethod)) {
      return;
    }

    const doSubmit = async (): Promise<string> => {
      let orgId: string;
      const sub = this.sub?.subscription;
      const isCanceled = sub?.status === "canceled";
      const isCancelledDowngradedToFreeOrg =
        sub?.cancelled && this.organization.productTierType === ProductTierType.Free;

      if (isCanceled || isCancelledDowngradedToFreeOrg) {
        await this.restartSubscription();
        orgId = this.organizationId;
      } else {
        orgId = await this.updateOrganization();
      }
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.isSubscriptionCanceled
          ? this.i18nService.t("restartOrganizationSubscription")
          : this.i18nService.t("organizationUpgraded"),
      });

      await this.syncService.fullSync(true);

      if (!this.acceptingSponsorship && !this.isInTrialFlow) {
        await this.router.navigate(["/organizations/" + orgId + "/billing/subscription"]);
      }

      if (this.isInTrialFlow) {
        this.onTrialBillingSuccess.emit({
          orgId: orgId,
          subLabelText: this.billingSubLabelText(),
        });
      }

      return orgId;
    };

    this.formPromise = doSubmit();
    const organizationId = await this.formPromise;
    this.onSuccess.emit({ organizationId: organizationId });
    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId });
    this.dialogRef.close();
  };

  private async restartSubscription() {
    const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
    const billingAddress = getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress);
    await this.subscriberBillingClient.restartSubscription(
      { type: "organization", data: this.organization },
      paymentMethod,
      billingAddress,
    );
    this.organizationWarningsService.refreshInactiveSubscriptionWarning();
  }

  private async updateOrganization() {
    const request = new OrganizationUpgradeRequest();
    if (this.selectedPlan.productTier !== ProductTierType.Families) {
      request.additionalSeats = this.sub?.seats;
    }
    if (this.sub?.maxStorageGb > this.selectedPlan.PasswordManager.baseStorageGb) {
      request.additionalStorageGb =
        this.sub?.maxStorageGb - this.selectedPlan.PasswordManager.baseStorageGb;
    }
    request.premiumAccessAddon =
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value;
    request.planType = this.selectedPlan.type;
    if (this.showPayment) {
      request.billingAddressCountry = this.billingFormGroup.controls.billingAddress.value.country;
      request.billingAddressPostalCode =
        this.billingFormGroup.controls.billingAddress.value.postalCode;
    }

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.upgradeRequiresPaymentMethod || this.showPayment || !this.paymentMethod) {
      const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
      const billingAddress = getBillingAddressFromForm(
        this.billingFormGroup.controls.billingAddress,
      );

      const subscriber: BitwardenSubscriber = { type: "organization", data: this.organization };
      // These need to be synchronous so one of them can create the Customer in the case we're upgrading from Free.
      await this.subscriberBillingClient.updateBillingAddress(subscriber, billingAddress);
      await this.subscriberBillingClient.updatePaymentMethod(subscriber, paymentMethod, null);
    }

    // Backfill pub/priv key if necessary
    if (!this.organization.hasPublicAndPrivateKeys) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const orgShareKey = await firstValueFrom(
        this.keyService
          .orgKeys$(userId)
          .pipe(map((orgKeys) => orgKeys?.[this.organizationId as OrganizationId] ?? null)),
      );
      const orgKeys = await this.keyService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    await this.organizationApiService.upgrade(this.organizationId, request);
    return this.organizationId;
  }

  private billingSubLabelText(): string {
    const selectedPlan = this.selectedPlan;
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
    request.useSecretsManager = this.organization.useSecretsManager;
    if (!this.organization.useSecretsManager) {
      return;
    }

    if (
      this.selectedPlan.SecretsManager.hasAdditionalSeatsOption &&
      this.currentPlan.productTier === ProductTierType.Free
    ) {
      request.additionalSmSeats = this.organization.seats;
    } else {
      request.additionalSmSeats = this.sub?.smSeats;
      request.additionalServiceAccounts = this.additionalServiceAccount;
    }
  }

  private upgradeFlowPrefillForm() {
    if (this.acceptingSponsorship) {
      this.formGroup.controls.productTier.setValue(ProductTierType.Families);
      this.changedProduct();
      return;
    }

    if (this.currentPlan && this.currentPlan.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) => {
        if (this.currentPlan.productTier === ProductTierType.Free) {
          return plan.type === PlanType.FamiliesAnnually;
        }

        if (
          this.currentPlan.productTier === ProductTierType.Families &&
          !this.teamsStarterPlanIsAvailable
        ) {
          return plan.type === PlanType.TeamsAnnually;
        }

        return plan.upgradeSortOrder === this.currentPlan.upgradeSortOrder + 1;
      });

      this.plan = upgradedPlan.type;
      this.productTier = upgradedPlan.productTier;
      this.changedProduct();
    }
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }

  toggleShowPayment() {
    this.showPayment = true;
  }

  toggleTotalOpened() {
    this.totalOpened = !this.totalOpened;
  }

  calculateTotalAppliedDiscount(total: number) {
    return total * (this.discountPercentageFromSub / 100);
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
    this.focusedIndex = index;
    await this.selectPlan(this.selectableProducts[index]);
  }

  isCardDisabled(index: number): boolean {
    const card = this.selectableProducts[index];
    return card === (this.currentPlan || this.isCardStateDisabled);
  }

  manageSelectableProduct(index: number) {
    return index;
  }

  private async refreshSalesTax(): Promise<void> {
    if (this.billingFormGroup.controls.billingAddress.invalid && !this.billingAddress) {
      return;
    }

    const getPlanFromLegacyEnum = (planType: PlanType): OrganizationSubscriptionPlan => {
      switch (planType) {
        case PlanType.FamiliesAnnually:
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
      : this.billingAddress;

    const taxAmounts = await this.taxClient.previewTaxForOrganizationSubscriptionPlanChange(
      this.organizationId,
      getPlanFromLegacyEnum(this.selectedPlan.type),
      billingAddress,
    );

    this.estimatedTax = taxAmounts.tax;
  }

  protected canUpdatePaymentInformation(): boolean {
    return (
      this.upgradeRequiresPaymentMethod ||
      this.showPayment ||
      !this.paymentMethod ||
      this.isSubscriptionCanceled
    );
  }

  get submitButtonLabel(): string {
    if (
      this.organization &&
      this.sub &&
      this.organization.productTierType !== ProductTierType.Free &&
      this.sub.subscription?.status === "canceled"
    ) {
      return this.i18nService.t("restart");
    } else {
      return this.i18nService.t("upgrade");
    }
  }

  get supportsTaxId() {
    return this.formGroup.value.productTier !== ProductTierType.Families;
  }

  getCardBrandIcon = () => getCardBrandIcon(this.paymentMethod);
}
