// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { UpdateProviderOrganizationRequest } from "@bitwarden/common/admin-console/models/request/update-provider-organization.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

type ManageClientNameDialogParams = {
  providerId: string;
  organization: {
    id: string;
    name: string;
    seats: number;
  };
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ManageClientNameDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

export const openManageClientNameDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<ManageClientNameDialogParams>,
) =>
  dialogService.open<ManageClientNameDialogResultType, ManageClientNameDialogParams>(
    ManageClientNameDialogComponent,
    dialogConfig,
  );

@Component({
  templateUrl: "manage-client-name-dialog.component.html",
  standalone: false,
})
export class ManageClientNameDialogComponent {
  protected ResultType = ManageClientNameDialogResultType;
  protected formGroup = this.formBuilder.group({
    name: [this.dialogParams.organization.name, Validators.required],
  });

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: ManageClientNameDialogParams,
    private providerApiService: ProviderApiServiceAbstraction,
    private dialogRef: DialogRef<ManageClientNameDialogResultType>,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const request = new UpdateProviderOrganizationRequest();
    request.assignedSeats = this.dialogParams.organization.seats;
    request.name = this.formGroup.value.name;

    await this.providerApiService.updateProviderOrganization(
      this.dialogParams.providerId,
      this.dialogParams.organization.id,
      request,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("updatedOrganizationName"),
    });

    this.dialogRef.close(this.ResultType.Submitted);
  };
}
