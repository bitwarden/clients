// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ProviderPlanResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { WebProviderService } from "../../../admin-console/providers/services/web-provider.service";

type CreateClientDialogParams = {
  providerId: string;
  plans: PlanResponse[];
};

export enum CreateClientDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

export const openCreateClientDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<CreateClientDialogParams>,
) =>
  dialogService.open<CreateClientDialogResultType, CreateClientDialogParams>(
    CreateClientDialogComponent,
    dialogConfig,
  );

type PlanCard = {
  name: string;
  cost: number;
  type: PlanType;
  plan: PlanResponse;
  selected: boolean;
};

@Component({
  templateUrl: "./create-client-dialog.component.html",
})
export class CreateClientDialogComponent implements OnInit {
  protected discountPercentage: number;
  protected formGroup = new FormGroup({
    clientOwnerEmail: new FormControl<string>("", [Validators.required, Validators.email]),
    organizationName: new FormControl<string>("", [Validators.required, Validators.maxLength(50)]),
    seats: new FormControl<number>(null, [Validators.required, Validators.min(1)]),
  });
  protected loading = true;
  protected planCards: PlanCard[];
  protected ResultType = CreateClientDialogResultType;

  private providerPlans: ProviderPlanResponse[];

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    @Inject(DIALOG_DATA) private dialogParams: CreateClientDialogParams,
    private dialogRef: DialogRef<CreateClientDialogResultType>,
    private i18nService: I18nService,
    private toastService: ToastService,
    private webProviderService: WebProviderService,
  ) {}

  protected getPlanCardContainerClasses(selected: boolean) {
    switch (selected) {
      case true: {
        return [
          "tw-group/plan-card-container",
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
      case false: {
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
    }
  }

  async ngOnInit(): Promise<void> {
    const response = await this.billingApiService.getProviderSubscription(
      this.dialogParams.providerId,
    );

    this.providerPlans = response?.plans ?? [];

    this.discountPercentage = response.discountPercentage;
    const discountFactor = this.discountPercentage ? (100 - this.discountPercentage) / 100 : 1;

    this.planCards = [];

    for (let i = 0; i < this.providerPlans.length; i++) {
      const providerPlan = this.providerPlans[i];
      const plan = this.dialogParams.plans.find((plan) => plan.type === providerPlan.type);

      let planName: string;
      switch (plan.productTier) {
        case ProductTierType.Teams: {
          planName = this.i18nService.t("planNameTeams");
          break;
        }
        case ProductTierType.Enterprise: {
          planName = this.i18nService.t("planNameEnterprise");
          break;
        }
      }

      this.planCards.push({
        name: planName,
        cost: plan.PasswordManager.providerPortalSeatPrice * discountFactor,
        type: plan.type,
        plan: plan,
        selected: i === 0,
      });
    }

    this.loading = false;
  }

  protected selectPlan(name: string) {
    this.planCards.find((planCard) => planCard.name === name).selected = true;
    this.planCards.find((planCard) => planCard.name !== name).selected = false;
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const selectedPlanCard = this.planCards.find((planCard) => planCard.selected);

    await this.webProviderService.createClientOrganization(
      this.dialogParams.providerId,
      this.formGroup.value.organizationName,
      this.formGroup.value.clientOwnerEmail,
      selectedPlanCard.type,
      this.formGroup.value.seats,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("createdNewClient"),
    });

    this.dialogRef.close(this.ResultType.Submitted);
  };

  protected get unassignedSeats(): number {
    const selectedProviderPlan = this.getSelectedProviderPlan();

    if (selectedProviderPlan === null) {
      return 0;
    }

    const openSeats = selectedProviderPlan.seatMinimum - selectedProviderPlan.assignedSeats;

    const unassignedSeats = openSeats - this.formGroup.value.seats;

    return unassignedSeats > 0 ? unassignedSeats : 0;
  }

  protected get additionalSeatsPurchased(): number {
    const selectedProviderPlan = this.getSelectedProviderPlan();

    if (selectedProviderPlan === null) {
      return 0;
    }

    if (selectedProviderPlan.purchasedSeats > 0) {
      return this.formGroup.value.seats;
    }

    const additionalSeatsPurchased =
      this.formGroup.value.seats +
      selectedProviderPlan.assignedSeats -
      selectedProviderPlan.seatMinimum;

    return additionalSeatsPurchased > 0 ? additionalSeatsPurchased : 0;
  }

  private getSelectedProviderPlan(): ProviderPlanResponse {
    if (this.loading || !this.planCards) {
      return null;
    }
    const selectedPlan = this.planCards.find((planCard) => planCard.selected).plan;
    return this.providerPlans.find((providerPlan) => providerPlan.planName === selectedPlan.name);
  }
}
