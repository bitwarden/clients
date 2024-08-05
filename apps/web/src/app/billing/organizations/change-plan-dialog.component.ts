import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
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
import { Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import {
  PaymentMethodType,
  PlanType,
  ProductTierType,
  PlanInterval,
} from "@bitwarden/common/billing/enums";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { BillingResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { PaymentComponent } from "../shared/payment.component";
import { TaxInfoComponent } from "../shared/tax-info.component";

type ChangePlanDialogParams = {
  organizationId: string;
  subscription: OrganizationSubscriptionResponse;
  productTierType: ProductTierType;
};

export enum ChangePlanDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

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

@Component({
  templateUrl: "./change-plan-dialog.component.html",
})
export class ChangePlanDialogComponent implements OnInit, OnDestroy {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent) taxComponent: TaxInfoComponent;

  @Input() acceptingSponsorship = false;
  @Input() organizationId: string;
  @Input() showFree = false;
  @Input() showCancel = false;
  selectedFile: File;

  @Input()
  get productTier(): ProductTierType {
    return this._productTier;
  }

  set productTier(product: ProductTierType) {
    this._productTier = product;
    this.formGroup?.controls?.productTier?.setValue(product);
  }

  private _productTier = ProductTierType.Free;

  @Input()
  get plan(): PlanType {
    return this._plan;
  }

  set plan(plan: PlanType) {
    this._plan = plan;
    this.formGroup?.controls?.plan?.setValue(plan);
  }

  private _plan = PlanType.Free;
  @Input() providerId?: string;
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  @Output() onCanceled = new EventEmitter<void>();
  @Output() onTrialBillingSuccess = new EventEmitter();

  protected discountPercentage: number = 20;
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
    planInterval: [1],
  });

  planType: string;
  selectedPlan: PlanResponse;
  selectedInterval: number = 1;
  planIntervals = PlanInterval;
  passwordManagerPlans: PlanResponse[];
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  billing: BillingResponse;
  currentPlanName: string;
  showPayment: boolean = false;
  totalOpened: boolean = false;
  currentPlan: PlanResponse;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: ChangePlanDialogParams,
    private dialogRef: DialogRef<ChangePlanDialogResultType>,
    private toastService: ToastService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private cryptoService: CryptoService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.dialogParams.organizationId) {
      this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
      this.sub =
        this.dialogParams.subscription ??
        (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
      this.organizationId = this.dialogParams.organizationId;
      this.currentPlan = this.sub?.plan;
      this.selectedPlan = this.sub?.plan;
      this.organization = await this.organizationService.get(this.organizationId);
      this.billing = await this.organizationApiService.getBilling(this.organizationId);
    }

    if (!this.selfHosted) {
      const plans = await this.apiService.getPlans();
      this.passwordManagerPlans = plans.data.filter((plan) => !!plan.PasswordManager);

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

    this.policyService
      .policyAppliesToActiveUser$(PolicyType.SingleOrg)
      .pipe(takeUntil(this.destroy$))
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

    this.formGroup
      .get("planInterval")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value: number) => (this.selectedInterval = value));

    this.discountPercentageFromSub = this.sub?.customerDiscount?.percentOff;

    this.setInitialPlanSelection();
    this.loading = false;
  }

  setInitialPlanSelection() {
    this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
  }

  getPlanByType(productTier: ProductTierType) {
    return this.selectableProducts.find((product) => product.productTier === productTier);
  }

  planTypeChanged() {
    this.selectPlan(this.getPlanByType(ProductTierType.Enterprise));
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

  protected getPlanCardContainerClasses(plan: PlanResponse, index: number) {
    let cardState: PlanCardState;

    if (plan == this.selectedPlan) {
      cardState = PlanCardState.Selected;
    } else if (
      this.selectedInterval === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      cardState = PlanCardState.Disabled;
    } else {
      cardState = PlanCardState.NotSelected;
    }

    switch (cardState) {
      case PlanCardState.Selected: {
        if (this.currentPlan.productTier === ProductTierType.Teams) {
          return [
            "tw-group",
            "tw-cursor-pointer",
            "tw-block",
            "tw-rounded",
            "tw-w-1/2",
            "tw-border",
            "tw-border-solid",
            "tw-border-primary-600",
            "hover:tw-border-primary-700",
            "focus:tw-border-2",
            "focus:tw-border-primary-700",
            "focus:tw-rounded-lg",
          ];
        } else {
          return [
            "tw-group",
            "tw-cursor-pointer",
            "tw-block",
            "tw-rounded",
            "tw-border",
            "tw-border-solid",
            "tw-border-primary-600",
            "hover:tw-border-primary-700",
            "focus:tw-border-2",
            "focus:tw-border-primary-700",
            "focus:tw-rounded-lg",
          ];
        }
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
        return [
          "tw-cursor-not-allowed",
          "tw-bg-secondary-100",
          "tw-font-normal",
          "tw-bg-blur",
          "tw-text-muted",
          "tw-block",
          "tw-rounded",
          "tw-border",
          "tw-border-solid",
          "tw-border-1",
          "tw-border-secondary-300",
        ];
      }
    }
  }

  protected selectPlan(plan: PlanResponse) {
    if (
      this.selectedInterval === PlanInterval.Monthly &&
      plan.productTier == ProductTierType.Families
    ) {
      return;
    }
    this.selectedPlan = plan;
    this.formGroup.patchValue({ productTier: plan.productTier });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get upgradeRequiresPaymentMethod() {
    return (
      this.organization?.productTierType === ProductTierType.Free &&
      !this.showFree &&
      !this.billing?.paymentSource
    );
  }

  get selectedPlanInterval() {
    return this.selectedPlan.isAnnual ? "year" : "month";
  }

  get selectableProducts() {
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

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result.reverse();
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

  passwordManagerSeatTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption) {
      return 0;
    }

    const result = plan.PasswordManager.seatPrice * Math.abs(this.organization.seats || 0);
    return result;
  }

  get passwordManagerSubtotal() {
    let subTotal = this.selectedPlan.PasswordManager.basePrice;
    if (this.selectedPlan.PasswordManager.hasAdditionalSeatsOption) {
      subTotal += this.passwordManagerSeatTotal(this.selectedPlan);
    }
    if (this.selectedPlan.PasswordManager.hasPremiumAccessOption) {
      subTotal += this.selectedPlan.PasswordManager.premiumAccessOptionPrice;
    }
    return subTotal - this.discount;
  }

  get taxCharges() {
    return this.taxComponent != null && this.taxComponent.taxRate != null
      ? (this.taxComponent.taxRate / 100) * this.passwordManagerSubtotal
      : 0;
  }

  get total() {
    return this.passwordManagerSubtotal + this.taxCharges || 0;
  }

  get teamsStarterPlanIsAvailable() {
    return this.selectablePlans.some((plan) => plan.type === PlanType.TeamsStarter);
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

  changedCountry() {
    if (this.paymentComponent && this.taxComponent) {
      this.paymentComponent!.hideBank = this.taxComponent?.taxFormGroup?.value.country !== "US";
      // Bank Account payments are only available for US customers
      if (
        this.paymentComponent.hideBank &&
        this.paymentComponent.method === PaymentMethodType.BankAccount
      ) {
        this.paymentComponent.method = PaymentMethodType.Card;
        this.paymentComponent.changeMethod();
      }
    }
  }

  submit = async () => {
    if (!this.taxComponent?.taxFormGroup.valid && this.taxComponent?.taxFormGroup.touched) {
      this.taxComponent?.taxFormGroup.markAllAsTouched();
      return;
    }

    const doSubmit = async (): Promise<string> => {
      let orgId: string = null;
      orgId = await this.updateOrganization(orgId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("organizationUpgraded"),
      });

      await this.apiService.refreshIdentityToken();
      await this.syncService.fullSync(true);

      if (!this.acceptingSponsorship && !this.isInTrialFlow) {
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

    this.formPromise = doSubmit();
    const organizationId = await this.formPromise;
    this.onSuccess.emit({ organizationId: organizationId });
    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId });
    this.dialogRef.close();
  };

  private async updateOrganization(orgId: string) {
    const request = new OrganizationUpgradeRequest();
    if (this.selectedPlan.productTier !== ProductTierType.Families) {
      request.additionalSeats = this.organization.seats;
    }
    request.premiumAccessAddon =
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value;
    request.planType = this.selectedPlan.type;
    if (this.showPayment) {
      request.billingAddressCountry = this.taxComponent.taxFormGroup?.value.country;
      request.billingAddressPostalCode = this.taxComponent.taxFormGroup?.value.postalCode;
    }

    if (this.upgradeRequiresPaymentMethod || this.showPayment) {
      const tokenResult = await this.paymentComponent.createPaymentToken();
      const paymentRequest = new PaymentRequest();
      paymentRequest.paymentToken = tokenResult[0];
      paymentRequest.paymentMethodType = tokenResult[1];
      paymentRequest.country = this.taxComponent.taxFormGroup?.value.country;
      paymentRequest.postalCode = this.taxComponent.taxFormGroup?.value.postalCode;
      await this.organizationApiService.updatePayment(this.organizationId, paymentRequest);
    }

    // Backfill pub/priv key if necessary
    if (!this.organization.hasPublicAndPrivateKeys) {
      const orgShareKey = await this.cryptoService.getOrgKey(this.organizationId);
      const orgKeys = await this.cryptoService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    const result = await this.organizationApiService.upgrade(this.organizationId, request);
    if (!result.success && result.paymentIntentClientSecret != null) {
      await this.paymentComponent.handleStripeCardPayment(result.paymentIntentClientSecret, null);
    }
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

  get paymentSourceClasses() {
    if (this.billing.paymentSource == null) {
      return [];
    }
    switch (this.billing.paymentSource.type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
        return ["bwi-bank"];
      case PaymentMethodType.Check:
        return ["bwi-money"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
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
    }
  }
}
