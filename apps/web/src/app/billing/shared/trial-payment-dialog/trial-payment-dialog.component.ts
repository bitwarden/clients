import { Component, EventEmitter, Inject, OnInit, Output, signal, ViewChild } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { ManageTaxInformationComponent } from "@bitwarden/angular/billing/components";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { PaymentMethodType, PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { ChangePlanFrequencyRequest } from "@bitwarden/common/billing/models/request/change-plan-frequency.request";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { UpdatePaymentMethodRequest } from "@bitwarden/common/billing/models/request/update-payment-method.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
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

import { PlanCardService } from "../../services/plan-card.service";
import { PaymentComponent } from "../payment/payment.component";
import { PlanCard } from "../plan-card/plan-card.component";
import { PricingSummaryData } from "../pricing-summary/pricing-summary.component";

import { PricingSummaryService } from "./../../services/pricing-summary.service";

type TrialPaymentDialogParams = {
  organizationId: string;
  subscription: OrganizationSubscriptionResponse;
  productTierType: ProductTierType;
  initialPaymentMethod?: PaymentMethodType;
};

export const TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE = {
  CLOSED: "closed",
  SUBMITTED: "submitted",
} as const;

export type TrialPaymentDialogResultType =
  (typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE)[keyof typeof TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE];

interface OnSuccessArgs {
  organizationId: string;
}

@Component({
  selector: "app-trial-payment-dialog",
  templateUrl: "./trial-payment-dialog.component.html",
  standalone: false,
})
export class TrialPaymentDialogComponent implements OnInit {
  @ViewChild(PaymentComponent) paymentComponent!: PaymentComponent;
  @ViewChild(ManageTaxInformationComponent) taxComponent!: ManageTaxInformationComponent;

  currentPlan!: PlanResponse;
  currentPlanName!: string;
  productTypes = ProductTierType;
  organization!: Organization;
  organizationId!: string;
  sub!: OrganizationSubscriptionResponse;
  selectedInterval: PlanInterval = PlanInterval.Annually;

  planCards = signal<PlanCard[]>([]);
  plans!: ListResponse<PlanResponse>;

  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  protected initialPaymentMethod: PaymentMethodType;
  protected taxInformation!: TaxInformation;
  protected readonly ResultType = TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE;
  pricingSummaryData!: PricingSummaryData;

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: TrialPaymentDialogParams,
    private dialogRef: DialogRef<TrialPaymentDialogResultType>,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private accountService: AccountService,
    private planCardService: PlanCardService,
    private pricingSummaryService: PricingSummaryService,
    private apiService: ApiService,
    private toastService: ToastService,
    private billingApiService: BillingApiServiceAbstraction,
    private organizationBillingApiServiceAbstraction: OrganizationBillingApiServiceAbstraction,
  ) {
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
  }

  async ngOnInit(): Promise<void> {
    this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
    this.sub =
      this.dialogParams.subscription ??
      (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
    this.organizationId = this.dialogParams.organizationId;
    this.currentPlan = this.sub?.plan;
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      throw new Error("User ID is required");
    }
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );
    if (!organization) {
      throw new Error("Organization not found");
    }
    this.organization = organization;

    const planCards = await this.planCardService.getCadenceCards(
      this.currentPlan,
      this.sub,
      this.isSecretsManagerTrial(),
    );

    this.planCards.set(planCards);

    if (!this.selectedInterval) {
      this.selectedInterval = planCards.find((card) => card.isSelected)?.isAnnual
        ? PlanInterval.Annually
        : PlanInterval.Monthly;
    }

    const taxInfo = await this.organizationApiService.getTaxInfo(this.organizationId);
    this.taxInformation = TaxInformation.from(taxInfo);

    this.pricingSummaryData = await this.pricingSummaryService.getPricingSummaryData(
      this.currentPlan,
      this.sub,
      this.organization,
      this.selectedInterval,
      this.taxInformation,
      this.isSecretsManagerTrial(),
    );

    this.plans = await this.apiService.getPlans();
  }

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<TrialPaymentDialogParams>,
  ) => dialogService.open<TrialPaymentDialogResultType>(TrialPaymentDialogComponent, dialogConfig);

  async setSelected(planCard: PlanCard) {
    this.selectedInterval = planCard.isAnnual ? PlanInterval.Annually : PlanInterval.Monthly;

    this.planCards.update((planCards) => {
      return planCards.map((planCard) => {
        if (planCard.isSelected) {
          return {
            ...planCard,
            isSelected: false,
          };
        } else {
          return {
            ...planCard,
            isSelected: true,
          };
        }
      });
    });

    await this.selectPlan();

    this.pricingSummaryData = await this.pricingSummaryService.getPricingSummaryData(
      this.currentPlan,
      this.sub,
      this.organization,
      this.selectedInterval,
      this.taxInformation,
      this.isSecretsManagerTrial(),
    );
  }

  protected async selectPlan() {
    if (
      this.selectedInterval === PlanInterval.Monthly &&
      this.currentPlan.productTier == ProductTierType.Families
    ) {
      return;
    }

    const filteredPlans = this.plans.data.filter(
      (plan) =>
        plan.productTier === this.currentPlan.productTier &&
        plan.isAnnual === (this.selectedInterval === PlanInterval.Annually),
    );
    if (filteredPlans.length > 0) {
      this.currentPlan = filteredPlans[0];
    }
    try {
      await this.refreshSalesTax();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const translatedMessage = this.i18nService.t(errorMessage);
      this.toastService.showToast({
        title: "",
        variant: "error",
        message: !translatedMessage || translatedMessage === "" ? errorMessage : translatedMessage,
      });
    }
  }

  protected get showTaxIdField(): boolean {
    switch (this.currentPlan.productTier) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return false;
      default:
        return true;
    }
  }

  private async refreshSalesTax(): Promise<void> {
    if (
      this.taxInformation === undefined ||
      !this.taxInformation.country ||
      !this.taxInformation.postalCode
    ) {
      return;
    }

    const request: PreviewOrganizationInvoiceRequest = {
      organizationId: this.organizationId,
      passwordManager: {
        additionalStorage: 0,
        plan: this.currentPlan?.type,
        seats: this.sub.seats,
      },
      taxInformation: {
        postalCode: this.taxInformation.postalCode,
        country: this.taxInformation.country,
        taxId: this.taxInformation.taxId,
      },
    };

    if (this.organization.useSecretsManager) {
      request.secretsManager = {
        seats: this.sub.smSeats ?? 0,
        additionalMachineAccounts:
          (this.sub.smServiceAccounts ?? 0) -
          (this.sub.plan.SecretsManager?.baseServiceAccount ?? 0),
      };
    }

    this.pricingSummaryData = await this.pricingSummaryService.getPricingSummaryData(
      this.currentPlan,
      this.sub,
      this.organization,
      this.selectedInterval,
      this.taxInformation,
      this.isSecretsManagerTrial(),
    );
  }

  async taxInformationChanged(event: TaxInformation) {
    this.taxInformation = event;
    this.toggleBankAccount();
    await this.refreshSalesTax();
  }

  toggleBankAccount = () => {
    this.paymentComponent.showBankAccount = this.taxInformation.country === "US";

    if (
      !this.paymentComponent.showBankAccount &&
      this.paymentComponent.selected === PaymentMethodType.BankAccount
    ) {
      this.paymentComponent.select(PaymentMethodType.Card);
    }
  };

  isSecretsManagerTrial(): boolean {
    return (
      this.sub?.subscription?.items?.some((item) =>
        this.sub?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  async onSubscribe(): Promise<void> {
    if (!this.taxComponent.validate()) {
      this.taxComponent.markAllAsTouched();
    }
    try {
      await this.updateOrganizationPaymentMethod(
        this.organizationId,
        this.paymentComponent,
        this.taxInformation,
      );

      if (this.currentPlan.type !== this.sub.planType) {
        const changePlanRequest = new ChangePlanFrequencyRequest();
        changePlanRequest.newPlanType = this.currentPlan.type;
        await this.organizationBillingApiServiceAbstraction.changeSubscriptionFrequency(
          this.organizationId,
          changePlanRequest,
        );
      }

      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("updatedPaymentMethod"),
      });

      this.onSuccess.emit({ organizationId: this.organizationId });
      this.dialogRef.close(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED);
    } catch (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error);
      this.toastService.showToast({
        variant: "error",
        title: undefined,
        message: this.i18nService.t(msg) || msg,
      });
    }
  }

  private async updateOrganizationPaymentMethod(
    organizationId: string,
    paymentComponent: PaymentComponent,
    taxInformation: TaxInformation,
  ): Promise<void> {
    const paymentSource = await paymentComponent.tokenize();

    const request = new UpdatePaymentMethodRequest();
    request.paymentSource = paymentSource;
    request.taxInformation = ExpandedTaxInfoUpdateRequest.From(taxInformation);

    await this.billingApiService.updateOrganizationPaymentMethod(organizationId, request);
  }

  resolvePlanName(productTier: ProductTierType): string {
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
      default:
        return this.i18nService.t("planNameFree");
    }
  }
}
