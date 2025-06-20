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
import { firstValueFrom, map, Subject, switchMap, takeUntil } from "rxjs";

import { ManageTaxInformationComponent } from "@bitwarden/angular/billing/components";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import {
  PaymentMethodType,
  PlanInterval,
  PlanType,
  ProductTierType,
} from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { BillingResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PaymentSourceResponse } from "@bitwarden/common/billing/models/response/payment-source.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { BillingSharedModule } from "../billing-shared.module";
import { PaymentComponent } from "../payment/payment.component";

import { PlanSelectionService } from "./plan-selection.service";
import { PricingCalculationService } from "./pricing-calculation.service";
import { TrialPaymentMethodService } from "./trial-payment-method.service";

// Types
interface TrialPaymentMethodParams {
  organizationId: string;
  subscription: OrganizationSubscriptionResponse;
  productTierType: ProductTierType;
  initialPaymentMethod?: PaymentMethodType;
}

export const TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE = {
  CLOSED: "closed",
  SUBMITTED: "submitted",
} as const;

export type TrialPaymentMethodDialogResultType =
  (typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE)[keyof typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE];

export const PLAN_CARD_STATE = {
  SELECTED: "selected",
  NOT_SELECTED: "not_selected",
  DISABLED: "disabled",
} as const;

export type PlanCardState = (typeof PLAN_CARD_STATE)[keyof typeof PLAN_CARD_STATE];

interface OnSuccessArgs {
  organizationId: string;
}

interface PlanCard {
  name: string;
  selected: boolean;
}

// Component
@Component({
  templateUrl: "./trial-payment-method-dialog.component.html",
  imports: [BillingSharedModule],
  providers: [TrialPaymentMethodService, PlanSelectionService, PricingCalculationService],
})
export class TrialPaymentMethodDialogComponent implements OnInit, OnDestroy {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(ManageTaxInformationComponent) taxComponent: ManageTaxInformationComponent;

  // Inputs
  @Input() acceptingSponsorship = false;
  @Input() organizationId: string;
  @Input() showFree = false;
  @Input() showCancel = false;

  @Input()
  get productTier(): ProductTierType {
    return this._productTier;
  }
  set productTier(product: ProductTierType) {
    this._productTier = product;
    this.formGroup?.controls?.productTier?.setValue(product);
  }

  @Input()
  get plan(): PlanType {
    return this._plan;
  }
  set plan(plan: PlanType) {
    this._plan = plan;
    this.formGroup?.controls?.plan?.setValue(plan);
  }

  @Input() providerId?: string;

  // Outputs
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  @Output() onCanceled = new EventEmitter<void>();
  @Output() onTrialBillingSuccess = new EventEmitter();

  // Public properties for template
  protected readonly ResultType = TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE;
  protected readonly productTypes = ProductTierType;
  protected readonly planIntervals = PlanInterval;

  protected loading = true;
  protected planCards: PlanCard[];
  protected initialPaymentMethod: PaymentMethodType;
  protected estimatedTax = 0;
  protected discountPercentage = 20;
  protected discountPercentageFromSub: number;
  protected totalOpened = false;
  protected focusedIndex: number | null = null;
  protected taxInformation: TaxInformation;

  // Private properties
  private _productTier = ProductTierType.Free;
  private _plan = PlanType.Free;
  private destroy$ = new Subject<void>();

  // Form
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

  // Data properties
  selfHosted = false;
  singleOrgPolicyAppliesToActiveUser = false;
  discount = 0;
  planType: string;
  selectedPlan: PlanResponse;
  selectedInterval: number = 1;
  passwordManagerPlans: PlanResponse[];
  secretsManagerPlans: PlanResponse[];
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  billing: BillingResponse;
  currentPlanName: string;
  showPayment = false;
  currentPlan: PlanResponse;
  isCardStateDisabled = false;
  accountCredit: number;
  paymentSource?: PaymentSourceResponse;
  plans: ListResponse<PlanResponse>;
  secretsManagerTotal: number;

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: TrialPaymentMethodParams,
    private dialogRef: DialogRef<TrialPaymentMethodDialogResultType>,
    private toastService: ToastService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private router: Router,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private billingApiService: BillingApiServiceAbstraction,
    private taxService: TaxServiceAbstraction,
    private accountService: AccountService,
    private trialPaymentMethodService: TrialPaymentMethodService,
    private planSelectionService: PlanSelectionService,
    private pricingCalculationService: PricingCalculationService,
  ) {
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
  }

  async ngOnInit(): Promise<void> {
    await this.initializeComponent();
    this.setupSubscriptions();
    this.initializePlanCards();
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Public methods for template
  resolveHeaderName(): string {
    return this.i18nService.t(
      "upgradeFreeOrganization",
      this.resolvePlanName(this.dialogParams.productTierType),
    );
  }

  isEnterprise(): boolean {
    return this.currentPlan?.productTier === ProductTierType.Enterprise;
  }

  isTeams(): boolean {
    return this.currentPlan?.productTier === ProductTierType.Teams;
  }

  isFamily(): boolean {
    return this.currentPlan?.productTier === ProductTierType.Families;
  }

  hasSecretsManager(): boolean {
    return this.organization?.canAccessSecretsManager ?? false;
  }

  isPaymentSourceEmpty(): boolean {
    return this.paymentSource === null || this.paymentSource === undefined;
  }

  isSecretsManagerTrial(): boolean {
    return this.trialPaymentMethodService.isSecretsManagerTrial(this.sub);
  }

  protected getPlanCardContainerClasses(plan: PlanResponse, index: number): string[] {
    return this.planSelectionService.getPlanCardContainerClasses(
      plan,
      index,
      this.isCardDisabled.bind(this),
    );
  }

  protected selectPlan(plan: PlanResponse): void {
    this.planSelectionService.selectPlan(
      plan,
      this.selectedInterval,
      this.currentPlan,
      (selectedPlan) => {
        this.selectedPlan = selectedPlan;
        this.formGroup.patchValue({ productTier: selectedPlan.productTier });
        this.refreshSalesTax();
      },
    );
  }

  get selectedPlanInterval(): string {
    return this.currentPlan?.isAnnual ? "year" : "month";
  }

  get selectablePlans(): PlanResponse[] {
    return this.planSelectionService.getSelectablePlans(
      this.passwordManagerPlans,
      this.selectedPlan,
      this.planIsEnabled.bind(this),
    );
  }

  get storageGb(): number {
    return this.sub?.maxStorageGb ? this.sub.maxStorageGb - 1 : 0;
  }

  get passwordManagerSubtotal(): number {
    return this.pricingCalculationService.calculatePasswordManagerSubtotal(
      this.selectedPlan,
      this.sub,
      this.discount,
    );
  }

  secretsManagerSubtotal(): number {
    return this.pricingCalculationService.calculateSecretsManagerSubtotal(
      this.selectedPlan,
      this.sub,
      this.secretsManagerTotal,
    );
  }

  get passwordManagerSeats(): number {
    return this.pricingCalculationService.getPasswordManagerSeats(this.selectedPlan, this.sub);
  }

  get total(): number {
    return this.pricingCalculationService.calculateTotal(
      this.organization,
      this.selectedPlan,
      this.passwordManagerSubtotal,
      this.estimatedTax,
      this.sub,
    );
  }

  get additionalServiceAccount(): number {
    return this.pricingCalculationService.calculateAdditionalServiceAccount(
      this.currentPlan,
      this.sub,
    );
  }

  get showTaxIdField(): boolean {
    return this.trialPaymentMethodService.shouldShowTaxIdField(
      this.organizationId,
      this.productTier,
      this.providerId,
    );
  }

  // Pricing calculation methods
  passwordManagerSeatTotal(plan: PlanResponse): number {
    return this.pricingCalculationService.calculatePasswordManagerSeatTotal(
      plan,
      this.sub,
      this.isSecretsManagerTrial(),
    );
  }

  secretsManagerSeatTotal(plan: PlanResponse, seats: number): number {
    return this.pricingCalculationService.calculateSecretsManagerSeatTotal(plan, seats);
  }

  additionalStorageTotal(plan: PlanResponse): number {
    return this.pricingCalculationService.calculateAdditionalStorageTotal(plan, this.sub);
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse): number {
    return selectedPlan.PasswordManager.additionalStoragePricePerGb;
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    return this.pricingCalculationService.calculateAdditionalServiceAccountTotal(
      plan,
      this.additionalServiceAccount,
    );
  }

  calculateTotalAppliedDiscount(total: number): number {
    return this.pricingCalculationService.calculateTotalAppliedDiscount(
      total,
      this.discountPercentageFromSub,
    );
  }

  // Event handlers
  changedProduct(): void {
    const selectedPlan = this.selectablePlans[0];
    this.setPlanType(selectedPlan.type);
    this.handlePremiumAddonAccess(selectedPlan.PasswordManager.hasPremiumAccessOption);
    this.handleAdditionalSeats(selectedPlan.PasswordManager.hasAdditionalSeatsOption);
  }

  changedCountry(): void {
    this.paymentComponent.showBankAccount = this.taxInformation.country === "US";

    if (
      !this.paymentComponent.showBankAccount &&
      this.paymentComponent.selected === PaymentMethodType.BankAccount
    ) {
      this.paymentComponent.select(PaymentMethodType.Card);
    }
  }

  protected taxInformationChanged(event: TaxInformation): void {
    this.taxInformation = event;
    this.changedCountry();
    this.refreshSalesTax();
  }

  toggleTotalOpened(): void {
    this.totalOpened = !this.totalOpened;
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    this.planSelectionService.handleKeydown(event, index, this.isCardDisabled.bind(this));
  }

  onFocus(index: number): void {
    this.focusedIndex = index;
    this.selectPlan(this.selectablePlans[index]);
  }

  isCardDisabled(index: number): boolean {
    const card = this.selectablePlans[index];
    return card === (this.currentPlan || this.isCardStateDisabled);
  }

  // Form submission
  submit = async (): Promise<void> => {
    if (!this.taxComponent.validate()) {
      this.taxComponent.markAllAsTouched();
      return;
    }

    try {
      await this.trialPaymentMethodService.submitPayment(
        this.organizationId,
        this.paymentComponent,
        this.taxInformation,
        this.billingApiService,
        this.apiService,
      );

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("updatedPaymentMethod"),
      });

      this.onSuccess.emit({ organizationId: this.organizationId });
      this.dialogRef.close(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED);
    } catch (error) {
      const msg = typeof error === "object" ? error.message : error;
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t(msg) || msg,
      });
    }
  };

  // Static method
  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<TrialPaymentMethodParams>,
  ) =>
    dialogService.open<TrialPaymentMethodDialogResultType>(
      TrialPaymentMethodDialogComponent,
      dialogConfig,
    );

  // Private methods
  private async initializeComponent(): Promise<void> {
    if (this.dialogParams.organizationId) {
      this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
      this.sub =
        this.dialogParams.subscription ??
        (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
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

    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.discountPercentageFromSub = this.isSecretsManagerTrial()
      ? 0
      : (this.sub?.customerDiscount?.percentOff ?? 0);

    this.setInitialPlanIntervalSelection();

    const taxInfo = await this.organizationApiService.getTaxInfo(this.organizationId);
    this.taxInformation = TaxInformation.from(taxInfo);
  }

  private setupSubscriptions(): void {
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
  }

  private initializePlanCards(): void {
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
  }

  private setInitialPlanIntervalSelection(): void {
    this.focusedIndex = this.selectablePlans.length - 1;
    this.selectPlan(this.selectablePlans.find((product) => product.isAnnual));
  }

  private setPlanType(planType: PlanType): void {
    this.formGroup.controls.plan.setValue(planType);
  }

  private handlePremiumAddonAccess(hasPremiumAccessOption: boolean): void {
    this.formGroup.controls.premiumAccessAddon.setValue(!hasPremiumAccessOption);
  }

  private handleAdditionalSeats(selectedPlanHasAdditionalSeatsOption: boolean): void {
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

  private planIsEnabled(plan: PlanResponse): boolean {
    return !plan.disabled && !plan.legacyYear;
  }

  private refreshSalesTax(): void {
    if (
      this.taxInformation === undefined ||
      !this.taxInformation.country ||
      !this.taxInformation.postalCode
    ) {
      return;
    }

    this.trialPaymentMethodService
      .refreshSalesTax(
        this.organizationId,
        this.selectedPlan,
        this.sub,
        this.organization,
        this.taxInformation,
        this.taxService,
        this.i18nService,
        this.toastService,
      )
      .then((taxAmount) => {
        this.estimatedTax = taxAmount;
      })
      .catch(() => {
        this.estimatedTax = 0;
      });
  }

  private resolvePlanName(productTier: ProductTierType): string {
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
}
