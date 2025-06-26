import { Component, Inject, OnInit, signal, ViewChild } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PaymentMethodType, PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";

import { PlanService } from "../../services/plan.service";
import { PaymentComponent } from "../payment/payment.component";
import { PlanCard } from "../plan-card/plan-card.component";

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

@Component({
  selector: "app-trial-payment-dialog",
  templateUrl: "./trial-payment-dialog.component.html",
  standalone: false,
})
export class TrialPaymentDialogComponent implements OnInit {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  currentPlan: PlanResponse;
  currentPlanName: string;
  productTypes = ProductTierType;
  organization: Organization;
  organizationId: string;
  sub: OrganizationSubscriptionResponse;
  selectedInterval: PlanInterval;
  secretsManagerTotal: number;

  planCards = signal<PlanCard[]>([]);

  loading = signal(true);
  protected initialPaymentMethod: PaymentMethodType;
  protected taxInformation: TaxInformation;
  protected totalOpened = false;
  protected estimatedTax: number = 0;
  protected readonly ResultType = TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE;

  constructor(
    @Inject(DIALOG_DATA) private dialogParams: TrialPaymentDialogParams,
    private dialogRef: DialogRef<TrialPaymentDialogResultType>,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private accountService: AccountService,
    private planService: PlanService,
  ) {
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(false);

    if (this.dialogParams.organizationId) {
      this.currentPlanName = this.resolvePlanName(this.dialogParams.productTierType);
      this.sub =
        this.dialogParams.subscription ??
        (await this.organizationApiService.getSubscription(this.dialogParams.organizationId));
      this.organizationId = this.dialogParams.organizationId;
      this.currentPlan = this.sub?.plan;
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );

      const result = await this.planService.getPlanCards(this.currentPlan, this.sub, true);

      const planCards = result
        .map((planCard) => {
          if (planCard.isAnnual) {
            return {
              ...planCard,
              isSelected: true,
            };
          }
          return planCard;
        })
        .reverse();

      this.planCards.set(planCards);
    }

    const taxInfo = await this.organizationApiService.getTaxInfo(this.organizationId);
    this.taxInformation = TaxInformation.from(taxInfo);
  }

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<TrialPaymentDialogParams>,
  ) => dialogService.open<TrialPaymentDialogResultType>(TrialPaymentDialogComponent, dialogConfig);

  setSelected(planCard: PlanCard) {
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
  }

  protected get showTaxIdField(): boolean {
    if (this.organizationId) {
      switch (this.currentPlan.productTier) {
        case ProductTierType.Free:
        case ProductTierType.Families:
          return false;
        default:
          return true;
      }
    }
  }

  taxInformationChanged(event: TaxInformation) {
    this.taxInformation = event;
    this.toggleBankAccount();
  }

  toggleBankAccount = () => {
    if (this.taxInformation.country === "US") {
      this.paymentComponent.showBankAccount = !!this.organizationId;
    } else {
      this.paymentComponent.showBankAccount = false;
      if (this.paymentComponent.selected === PaymentMethodType.BankAccount) {
        this.paymentComponent.select(PaymentMethodType.Card);
      }
    }
  };

  isSecretsManagerTrial(): boolean {
    return (
      this.sub?.subscription?.items?.some((item) =>
        this.sub?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  get additionalServiceAccount(): number {
    if (!this.currentPlan || !this.currentPlan.SecretsManager) {
      return 0;
    }
    const baseServiceAccount = this.currentPlan.SecretsManager?.baseServiceAccount || 0;
    const usedServiceAccounts = this.sub?.smServiceAccounts || 0;
    const additionalServiceAccounts = baseServiceAccount - usedServiceAccounts;
    return additionalServiceAccounts <= 0 ? Math.abs(additionalServiceAccounts) : 0;
  }

  passwordManagerSeatTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption || this.isSecretsManagerTrial()) {
      return 0;
    }

    const result = plan.PasswordManager.seatPrice * Math.abs(this.sub?.seats || 0);
    return result;
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
    if (!this.currentPlan || !this.currentPlan.PasswordManager) {
      return 0;
    }

    let subTotal = this.currentPlan.PasswordManager.basePrice;
    if (this.currentPlan.PasswordManager.hasAdditionalSeatsOption) {
      subTotal += this.passwordManagerSeatTotal(this.currentPlan);
    }
    if (this.currentPlan.PasswordManager.hasPremiumAccessOption) {
      subTotal += this.currentPlan.PasswordManager.premiumAccessOptionPrice;
    }
    return subTotal;
  }

  secretsManagerSubtotal() {
    const plan = this.currentPlan;
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
    if (!this.currentPlan) {
      return 0;
    }

    if (this.currentPlan.productTier === ProductTierType.Families) {
      return this.currentPlan.PasswordManager.baseSeats;
    }
    return this.sub?.seats;
  }

  get total() {
    if (!this.organization || !this.currentPlan) {
      return 0;
    }

    if (this.organization.useSecretsManager) {
      return (
        this.passwordManagerSubtotal +
        this.additionalStorageTotal(this.currentPlan) +
        this.secretsManagerSubtotal() +
        this.estimatedTax
      );
    }
    return (
      this.passwordManagerSubtotal +
      this.additionalStorageTotal(this.currentPlan) +
      this.estimatedTax
    );
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
}
