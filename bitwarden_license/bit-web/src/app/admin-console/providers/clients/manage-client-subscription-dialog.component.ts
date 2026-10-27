import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { UpdateProviderOrganizationRequest } from "@bitwarden/common/admin-console/models/request/update-provider-organization.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProviderPlanResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./manage-client-subscription-dialog.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    I18nPipe,
    DialogModule,
    FormFieldModule,
    ButtonModule,
    AsyncActionsModule,
  ],
})
export class ManageClientSubscriptionDialogComponent implements OnInit {
  protected loading = true;
  protected providerPlan?: ProviderPlanResponse;
  protected assignedSeats = 0;
  protected openSeats = 0;
  protected purchasedSeats = 0;
  protected seatMinimum = 0;
  protected readonly ResultType = ManageClientSubscriptionDialogResultType;

  protected formGroup = new FormGroup({
    assignedSeats: new FormControl<number>(this.dialogParams.organization.seats ?? 0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(this.dialogParams.organization.occupiedSeats ?? 0),
      ],
    }),
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

      if (this.providerPlan == null) {
        return;
      }

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
      const request = new UpdateProviderOrganizationRequest({
        assignedSeats: this.formGroup.controls.assignedSeats.value,
        name: this.dialogParams.organization.organizationName,
      });

      await this.providerApiService.updateProviderOrganization(
        this.dialogParams.provider.id,
        this.dialogParams.organization.id,
        request,
      );

      this.billingNotificationService.showSuccess(this.i18nService.t("subscriptionUpdated"));

      await this.dialogRef.close(this.ResultType.Submitted);
    } catch (error) {
      this.billingNotificationService.handleError(error);
    } finally {
      this.loading = false;
    }
  };

  createPurchasedSeatsValidator =
    (): ValidatorFn =>
    (control: AbstractControl<number | null>): ValidationErrors | null => {
      if (control.value == null) {
        return null;
      }

      if (this.isProviderAdmin) {
        return null;
      }

      const seatAdjustment = control.value - this.organizationSeats;

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
    (control: AbstractControl<number | null>): ValidationErrors | null => {
      if (control.value == null) {
        return null;
      }

      if (this.isProviderAdmin) {
        return null;
      }

      const seatAdjustment = control.value - this.organizationSeats;

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
    const seatDifference = this.formGroup.controls.assignedSeats.value - this.organizationSeats;

    const unassignedSeats = this.openSeats - seatDifference;

    return unassignedSeats >= 0 ? unassignedSeats : 0;
  }

  get additionalSeatsPurchased(): number {
    const seatDifference = this.formGroup.controls.assignedSeats.value - this.organizationSeats;

    if (this.purchasedSeats > 0) {
      return seatDifference;
    }

    return seatDifference - this.openSeats;
  }

  get purchasedSeatsRemoved(): number {
    const seatDifference = this.organizationSeats - this.formGroup.controls.assignedSeats.value;

    if (this.purchasedSeats >= seatDifference) {
      return seatDifference;
    }

    return this.purchasedSeats;
  }

  private get organizationSeats(): number {
    return this.dialogParams.organization.seats ?? 0;
  }

  get isProviderAdmin(): boolean {
    return this.dialogParams.provider.type === ProviderUserType.ProviderAdmin;
  }

  get isServiceUserWithPurchasedSeats(): boolean {
    return (
      !this.isProviderAdmin && this.providerPlan != null && this.providerPlan.purchasedSeats > 0
    );
  }

  get purchasingSeats(): boolean {
    return this.additionalSeatsPurchased > 0;
  }

  get sellingSeats(): boolean {
    return this.purchasedSeats > 0 && this.additionalSeatsPurchased < 0;
  }
}
