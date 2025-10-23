// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { UpdateProviderOrganizationRequest } from "@bitwarden/common/admin-console/models/request/update-provider-organization.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProviderPlanResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";

type ManageClientSubscriptionDialogParams = {
  organization: ProviderOrganizationOrganizationDetailsResponse;
  provider: Provider;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ManageClientSubscriptionDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

export const openManageClientSubscriptionDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<ManageClientSubscriptionDialogParams>,
) =>
  dialogService.open<
    ManageClientSubscriptionDialogResultType,
    ManageClientSubscriptionDialogParams
  >(ManageClientSubscriptionDialogComponent, dialogConfig);

@Component({
  templateUrl: "./manage-client-subscription-dialog.component.html",
  standalone: false,
})
export class ManageClientSubscriptionDialogComponent implements OnInit {
  protected loading = true;
  protected providerPlan: ProviderPlanResponse;
  protected assignedSeats: number;
  protected openSeats: number;
  protected purchasedSeats: number;
  protected seatMinimum: number;
  protected readonly ResultType = ManageClientSubscriptionDialogResultType;

  protected formGroup = new FormGroup({
    assignedSeats: new FormControl<number>(this.dialogParams.organization.seats, [
      Validators.required,
      Validators.min(this.dialogParams.organization.occupiedSeats),
    ]),
  });

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private providerApiService: ProviderApiServiceAbstraction,
    @Inject(DIALOG_DATA) protected dialogParams: ManageClientSubscriptionDialogParams,
    private dialogRef: DialogRef<ManageClientSubscriptionDialogResultType>,
    private i18nService: I18nService,
    private billingNotificationService: BillingNotificationService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.billingApiService.getProviderSubscription(
        this.dialogParams.provider.id,
      );

      this.providerPlan = response.plans.find(
        (plan) => plan.planName === this.dialogParams.organization.plan,
      );

      this.assignedSeats = this.providerPlan.assignedSeats;
      this.openSeats = this.providerPlan.seatMinimum - this.providerPlan.assignedSeats;
      this.purchasedSeats = this.providerPlan.purchasedSeats;
      this.seatMinimum = this.providerPlan.seatMinimum;

      this.formGroup.controls.assignedSeats.addValidators(
        this.isServiceUserWithPurchasedSeats
          ? this.createPurchasedSeatsValidator()
          : this.createUnassignedSeatsValidator(),
      );
    } catch (error) {
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading = false;
    }
  }

  submit = async () => {
    this.loading = true;

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    try {
      const request = new UpdateProviderOrganizationRequest();
      request.assignedSeats = this.formGroup.value.assignedSeats;
      request.name = this.dialogParams.organization.organizationName;

      await this.providerApiService.updateProviderOrganization(
        this.dialogParams.provider.id,
        this.dialogParams.organization.id,
        request,
      );

      this.billingNotificationService.showSuccess(this.i18nService.t("subscriptionUpdated"));

      this.dialogRef.close(this.ResultType.Submitted);
    } catch (error) {
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading = false;
    }
  };

  createPurchasedSeatsValidator =
    (): ValidatorFn =>
    (formControl: FormControl<number>): ValidationErrors | null => {
      if (this.isProviderAdmin) {
        return null;
      }

      const seatAdjustment = formControl.value - this.dialogParams.organization.seats;

      if (seatAdjustment <= 0) {
        return null;
      }

      return {
        insufficientPermissions: {
          message: this.i18nService.t("contactYourProviderForAdditionalSeats"),
        },
      };
    };

  createUnassignedSeatsValidator =
    (): ValidatorFn =>
    (formControl: FormControl<number>): ValidationErrors | null => {
      if (this.isProviderAdmin) {
        return null;
      }

      const seatAdjustment = formControl.value - this.dialogParams.organization.seats;

      if (seatAdjustment <= this.openSeats) {
        return null;
      }

      const unassignedSeatsAvailableMessage = this.i18nService.t(
        "unassignedSeatsAvailable",
        this.openSeats,
      );

      const contactYourProviderMessage = this.i18nService.t(
        "contactYourProviderForAdditionalSeats",
      );

      return {
        insufficientPermissions: {
          message: `${unassignedSeatsAvailableMessage} ${contactYourProviderMessage}`,
        },
      };
    };

  get unassignedSeats(): number {
    const seatDifference =
      this.formGroup.value.assignedSeats - this.dialogParams.organization.seats;

    const unassignedSeats = this.openSeats - seatDifference;

    return unassignedSeats >= 0 ? unassignedSeats : 0;
  }

  get additionalSeatsPurchased(): number {
    const seatDifference =
      this.formGroup.value.assignedSeats - this.dialogParams.organization.seats;

    if (this.purchasedSeats > 0) {
      return seatDifference;
    }

    return seatDifference - this.openSeats;
  }

  get purchasedSeatsRemoved(): number {
    const seatDifference =
      this.dialogParams.organization.seats - this.formGroup.value.assignedSeats;

    if (this.purchasedSeats >= seatDifference) {
      return seatDifference;
    }

    return this.purchasedSeats;
  }

  get isProviderAdmin(): boolean {
    return this.dialogParams.provider.type === ProviderUserType.ProviderAdmin;
  }

  get isServiceUserWithPurchasedSeats(): boolean {
    return !this.isProviderAdmin && this.providerPlan && this.providerPlan.purchasedSeats > 0;
  }

  get purchasingSeats(): boolean {
    return this.additionalSeatsPurchased > 0;
  }

  get sellingSeats(): boolean {
    return this.purchasedSeats > 0 && this.additionalSeatsPurchased < 0;
  }
}
