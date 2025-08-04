// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { from, Subject, switchMap, takeUntil } from "rxjs";

import { ManageTaxInformationComponent } from "@bitwarden/angular/billing/components";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  BillingInformation,
  OrganizationBillingServiceAbstraction as OrganizationBillingService,
  OrganizationInformation,
  PaymentInformation,
  PlanInformation,
} from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import {
  PaymentMethodType,
  PlanType,
  ProductTierType,
  ProductType,
} from "@bitwarden/common/billing/enums";
import { PreviewTaxAmountForOrganizationTrialRequest } from "@bitwarden/common/billing/models/request/tax";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ToastService } from "@bitwarden/components";

import { BillingSharedModule } from "../../shared";
import { PaymentComponent } from "../../shared/payment/payment.component";

export type TrialOrganizationType = Exclude<ProductTierType, ProductTierType.Free>;

export interface OrganizationInfo {
  name: string;
  email: string;
  type: TrialOrganizationType;
}

export interface OrganizationCreatedEvent {
  organizationId: string;
  planDescription: string;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum SubscriptionCadence {
  Annual,
  Monthly,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SubscriptionProduct {
  PasswordManager,
  SecretsManager,
}

@Component({
  selector: "app-trial-billing-step",
  templateUrl: "trial-billing-step.component.html",
  imports: [BillingSharedModule],
})
export class TrialBillingStepComponent implements OnInit, OnDestroy {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(ManageTaxInformationComponent) taxInfoComponent: ManageTaxInformationComponent;
  @Input() organizationInfo: OrganizationInfo;
  @Input() subscriptionProduct: SubscriptionProduct = SubscriptionProduct.PasswordManager;
  @Input() trialLength: number;
  @Output() steppedBack = new EventEmitter();
  @Output() organizationCreated = new EventEmitter<OrganizationCreatedEvent>();

  loading = true;
  fetchingTaxAmount = false;

  annualCadence = SubscriptionCadence.Annual;
  monthlyCadence = SubscriptionCadence.Monthly;

  formGroup = this.formBuilder.group({
    cadence: [SubscriptionCadence.Annual, Validators.required],
  });
  formPromise: Promise<string>;

  applicablePlans: PlanResponse[];
  annualPlan?: PlanResponse;
  monthlyPlan?: PlanResponse;

  taxAmount = 0;

  private destroy$ = new Subject<void>();

  protected readonly SubscriptionProduct = SubscriptionProduct;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private messagingService: MessagingService,
    private organizationBillingService: OrganizationBillingService,
    private toastService: ToastService,
    private taxService: TaxServiceAbstraction,
  ) {}

  async ngOnInit(): Promise<void> {
    const plans = await this.apiService.getPlans();
    this.applicablePlans = plans.data.filter(this.isApplicable);
    this.annualPlan = this.findPlanFor(SubscriptionCadence.Annual);
    this.monthlyPlan = this.findPlanFor(SubscriptionCadence.Monthly);

    if (this.trialLength === 0) {
      this.formGroup.controls.cadence.valueChanges
        .pipe(
          switchMap((cadence) => from(this.previewTaxAmount(cadence))),
          takeUntil(this.destroy$),
        )
        .subscribe((taxAmount) => {
          this.taxAmount = taxAmount;
        });
    }

    this.loading = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async submit(): Promise<void> {
    if (!this.taxInfoComponent.validate()) {
      return;
    }

    this.formPromise = this.createOrganization();

    const organizationId = await this.formPromise;
    const planDescription = this.getPlanDescription();

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("organizationCreated"),
      message: this.i18nService.t("organizationReadyToGo"),
    });

    this.organizationCreated.emit({
      organizationId,
      planDescription,
    });

    // TODO: No one actually listening to this?
    this.messagingService.send("organizationCreated", { organizationId });
  }

  async onTaxInformationChanged() {
    if (this.trialLength === 0) {
      this.taxAmount = await this.previewTaxAmount(this.formGroup.value.cadence);
    }

    this.paymentComponent.showBankAccount =
      this.taxInfoComponent.getTaxInformation().country === "US";
    if (
      !this.paymentComponent.showBankAccount &&
      this.paymentComponent.selected === PaymentMethodType.BankAccount
    ) {
      this.paymentComponent.select(PaymentMethodType.Card);
    }
  }

  protected getPriceFor(cadence: SubscriptionCadence): number {
    const plan = this.findPlanFor(cadence);
    return this.subscriptionProduct === SubscriptionProduct.PasswordManager
      ? plan.PasswordManager.basePrice === 0
        ? plan.PasswordManager.seatPrice
        : plan.PasswordManager.basePrice
      : plan.SecretsManager.basePrice === 0
        ? plan.SecretsManager.seatPrice
        : plan.SecretsManager.basePrice;
  }

  protected stepBack() {
    this.steppedBack.emit();
  }

  private async createOrganization(): Promise<string> {
    const planResponse = this.findPlanFor(this.formGroup.value.cadence);

    const { type, token } = await this.paymentComponent.tokenize();
    const paymentMethod: [string, PaymentMethodType] = [token, type];

    const organization: OrganizationInformation = {
      name: this.organizationInfo.name,
      billingEmail: this.organizationInfo.email,
      initiationPath:
        this.subscriptionProduct === SubscriptionProduct.PasswordManager
          ? "Password Manager trial from marketing website"
          : "Secrets Manager trial from marketing website",
    };

    const plan: PlanInformation = {
      type: planResponse.type,
      passwordManagerSeats: 1,
    };

    if (this.subscriptionProduct === SubscriptionProduct.SecretsManager) {
      plan.subscribeToSecretsManager = true;
      plan.isFromSecretsManagerTrial = true;
      plan.secretsManagerSeats = 1;
    }

    const payment: PaymentInformation = {
      paymentMethod,
      billing: this.getBillingInformationFromTaxInfoComponent(),
      skipTrial: this.trialLength === 0,
    };

    const response = await this.organizationBillingService.purchaseSubscription({
      organization,
      plan,
      payment,
    });

    return response.id;
  }

  private productTypeToPlanTypeMap: {
    [productType in TrialOrganizationType]: {
      [cadence in SubscriptionCadence]?: PlanType;
    };
  } = {
    [ProductTierType.Enterprise]: {
      [SubscriptionCadence.Annual]: PlanType.EnterpriseAnnually,
      [SubscriptionCadence.Monthly]: PlanType.EnterpriseMonthly,
    },
    [ProductTierType.Families]: {
      [SubscriptionCadence.Annual]: PlanType.FamiliesAnnually,
      // No monthly option for Families plan
    },
    [ProductTierType.Teams]: {
      [SubscriptionCadence.Annual]: PlanType.TeamsAnnually,
      [SubscriptionCadence.Monthly]: PlanType.TeamsMonthly,
    },
    [ProductTierType.TeamsStarter]: {
      // No annual option for Teams Starter plan
      [SubscriptionCadence.Monthly]: PlanType.TeamsStarter,
    },
  };

  private findPlanFor(cadence: SubscriptionCadence): PlanResponse | null {
    const productType = this.organizationInfo.type;
    const planType = this.productTypeToPlanTypeMap[productType]?.[cadence];
    return planType ? this.applicablePlans.find((plan) => plan.type === planType) : null;
  }

  private getBillingInformationFromTaxInfoComponent(): BillingInformation {
    return {
      postalCode: this.taxInfoComponent.getTaxInformation()?.postalCode,
      country: this.taxInfoComponent.getTaxInformation()?.country,
      taxId: this.taxInfoComponent.getTaxInformation()?.taxId,
      addressLine1: this.taxInfoComponent.getTaxInformation()?.line1,
      addressLine2: this.taxInfoComponent.getTaxInformation()?.line2,
      city: this.taxInfoComponent.getTaxInformation()?.city,
      state: this.taxInfoComponent.getTaxInformation()?.state,
    };
  }

  private getPlanDescription(): string {
    const plan = this.findPlanFor(this.formGroup.value.cadence);
    const price =
      this.subscriptionProduct === SubscriptionProduct.PasswordManager
        ? plan.PasswordManager.basePrice === 0
          ? plan.PasswordManager.seatPrice
          : plan.PasswordManager.basePrice
        : plan.SecretsManager.basePrice === 0
          ? plan.SecretsManager.seatPrice
          : plan.SecretsManager.basePrice;

    switch (this.formGroup.value.cadence) {
      case SubscriptionCadence.Annual:
        return `${this.i18nService.t("annual")} ($${price}/${this.i18nService.t("yr")})`;
      case SubscriptionCadence.Monthly:
        return `${this.i18nService.t("monthly")} ($${price}/${this.i18nService.t("monthAbbr")})`;
    }
  }

  private isApplicable(plan: PlanResponse): boolean {
    const hasCorrectProductType =
      plan.productTier === ProductTierType.Enterprise ||
      plan.productTier === ProductTierType.Families ||
      plan.productTier === ProductTierType.Teams ||
      plan.productTier === ProductTierType.TeamsStarter;
    const notDisabledOrLegacy = !plan.disabled && !plan.legacyYear;
    return hasCorrectProductType && notDisabledOrLegacy;
  }

  private previewTaxAmount = async (cadence: SubscriptionCadence): Promise<number> => {
    this.fetchingTaxAmount = true;

    if (!this.taxInfoComponent.validate()) {
      this.fetchingTaxAmount = false;
      return 0;
    }

    const plan = this.findPlanFor(cadence);

    const productType =
      this.subscriptionProduct === SubscriptionProduct.PasswordManager
        ? ProductType.PasswordManager
        : ProductType.SecretsManager;

    const taxInformation = this.taxInfoComponent.getTaxInformation();

    const request: PreviewTaxAmountForOrganizationTrialRequest = {
      planType: plan.type,
      productType,
      taxInformation: {
        ...taxInformation,
      },
    };

    const response = await this.taxService.previewTaxAmountForOrganizationTrial(request);
    this.fetchingTaxAmount = false;
    return response;
  };

  get price() {
    return this.getPriceFor(this.formGroup.value.cadence);
  }

  get total() {
    return this.price + this.taxAmount;
  }

  get interval() {
    return this.formGroup.value.cadence === SubscriptionCadence.Annual ? "year" : "month";
  }
}
