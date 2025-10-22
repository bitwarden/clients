import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ProviderPlanResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

type CreateClientDialogParams = {
  providerId: string;
  plans: PlanResponse[];
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum CreateClientDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

export const openCreateClientDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<
    CreateClientDialogParams,
    DialogRef<CreateClientDialogResultType, unknown>
  >,
) =>
  dialogService.open<CreateClientDialogResultType, CreateClientDialogParams>(
    CreateClientDialogComponent,
    dialogConfig,
  );

export class PlanCard {
  readonly name: string;
  private readonly cost: number;
  readonly type: PlanType;
  readonly plan: PlanResponse;
  selected: boolean;

  constructor(name: string, cost: number, type: PlanType, plan: PlanResponse, selected: boolean) {
    this.name = name;
    this.cost = cost;
    this.type = type;
    this.plan = plan;
    this.selected = selected;
  }

  getMonthlyCost(): number {
    return this.plan.isAnnual ? this.cost / 12 : this.cost;
  }

  getTimePerMemberLabel(): string {
    return this.plan.isAnnual ? "monthPerMemberBilledAnnually" : "monthPerMember";
  }

  getContainerClasses() {
    switch (this.selected) {
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
}

@Component({
  templateUrl: "./create-client-dialog.component.html",
  standalone: false,
})
export class CreateClientDialogComponent implements OnInit {
  protected discountPercentage: number | null | undefined;
  protected formGroup = new FormGroup({
    clientOwnerEmail: new FormControl<string>("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    organizationName: new FormControl<string>("", {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    seats: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });
  protected loading = true;
  protected planCards: PlanCard[] = [];
  protected ResultType = CreateClientDialogResultType;

  private providerPlans: ProviderPlanResponse[] = [];

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    @Inject(DIALOG_DATA) private dialogParams: CreateClientDialogParams,
    private dialogRef: DialogRef<CreateClientDialogResultType>,
    private i18nService: I18nService,
    private toastService: ToastService,
    private webProviderService: WebProviderService,
    private accountService: AccountService,
  ) {}

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

      if (!plan) {
        continue;
      }

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
        default:
          continue;
      }

      this.planCards.push(
        new PlanCard(
          planName,
          plan.PasswordManager.providerPortalSeatPrice * discountFactor,
          plan.type,
          plan,
          i === 0,
        ),
      );
    }

    this.loading = false;
  }

  protected selectPlan(name: string) {
    this.planCards.forEach((planCard) => {
      planCard.selected = planCard.name === name;
    });
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const selectedPlanCard = this.planCards.find((planCard) => planCard.selected);

    if (!selectedPlanCard) {
      return;
    }
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.webProviderService.createClientOrganization(
      this.dialogParams.providerId,
      this.formGroup.controls.organizationName.value,
      this.formGroup.controls.clientOwnerEmail.value,
      selectedPlanCard.type,
      this.formGroup.controls.seats.value,
      activeUserId,
    );

    this.toastService.showToast({
      variant: "success",
      title: "",
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

    const unassignedSeats = openSeats - this.formGroup.controls.seats.value;

    return unassignedSeats > 0 ? unassignedSeats : 0;
  }

  protected get additionalSeatsPurchased(): number {
    const selectedProviderPlan = this.getSelectedProviderPlan();

    if (selectedProviderPlan === null) {
      return 0;
    }

    if (selectedProviderPlan.purchasedSeats > 0) {
      return this.formGroup.controls.seats.value;
    }

    const additionalSeatsPurchased =
      this.formGroup.controls.seats.value +
      selectedProviderPlan.assignedSeats -
      selectedProviderPlan.seatMinimum;

    return additionalSeatsPurchased > 0 ? additionalSeatsPurchased : 0;
  }

  private getSelectedProviderPlan(): ProviderPlanResponse | null {
    if (this.loading || !this.planCards) {
      return null;
    }
    const selectedPlan = this.planCards.find((planCard) => planCard.selected)!.plan;
    return this.providerPlans.find((providerPlan) => providerPlan.planName === selectedPlan.name)!;
  }
}
