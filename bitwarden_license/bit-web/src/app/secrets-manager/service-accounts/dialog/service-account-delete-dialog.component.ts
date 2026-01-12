// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  AbstractControl,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import { ServiceAccountView } from "../../models/view/service-account.view";
import {
  BulkOperationStatus,
  BulkStatusDetails,
  BulkStatusDialogComponent,
} from "../../shared/dialogs/bulk-status-dialog.component";
import { ServiceAccountService } from "../service-account.service";

export interface ServiceAccountDeleteOperation {
  serviceAccounts: ServiceAccountView[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./service-account-delete-dialog.component.html",
  standalone: false,
})
export class ServiceAccountDeleteDialogComponent {
  formGroup = new FormGroup({
    confirmDelete: new FormControl("", [this.matchConfirmationMessageValidator()]),
  });

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: ServiceAccountDeleteOperation,
    private serviceAccountService: ServiceAccountService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  get title() {
    return this.data.serviceAccounts.length === 1
      ? this.i18nService.t("deleteMachineAccount")
      : this.i18nService.t("deleteMachineAccounts");
  }

  get dialogContent() {
    return this.data.serviceAccounts.length === 1
      ? this.i18nService.t("deleteMachineAccountDialogMessage", this.data.serviceAccounts[0].name)
      : this.i18nService.t("deleteMachineAccountsDialogMessage");
  }

  get dialogConfirmationLabel() {
    return this.i18nService.t("deleteProjectInputLabel", this.dialogConfirmationMessage);
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    await this.delete();
    this.dialogRef.close();
  };

  async delete() {
    const bulkResponses = await this.serviceAccountService.delete(this.data.serviceAccounts);

    const errors = bulkResponses.filter((response) => response.errorMessage);
    if (errors.length > 0) {
      this.openBulkStatusDialog(errors);
      return;
    }

    const message =
      this.data.serviceAccounts.length === 1
        ? "deleteMachineAccountToast"
        : "deleteMachineAccountsToast";
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });
  }

  openBulkStatusDialog(bulkStatusResults: BulkOperationStatus[]) {
    this.dialogService.open<unknown, BulkStatusDetails>(BulkStatusDialogComponent, {
      data: {
        title: "deleteMachineAccounts",
        subTitle: "machineAccounts",
        columnTitle: "machineAccountName",
        message: "bulkDeleteProjectsErrorMessage",
        details: bulkStatusResults,
      },
    });
  }

  private get dialogConfirmationMessage() {
    return this.data.serviceAccounts?.length === 1
      ? this.i18nService.t("deleteProjectConfirmMessage", this.data.serviceAccounts[0].name)
      : this.i18nService.t(
          "deleteMachineAccountsConfirmMessage",
          this.data.serviceAccounts?.length.toString(),
        );
  }

  private matchConfirmationMessageValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (this.dialogConfirmationMessage.toLowerCase() == control.value.toLowerCase()) {
        return null;
      } else {
        return {
          confirmationDoesntMatchError: {
            message: this.i18nService.t("smConfirmationRequired"),
          },
        };
      }
    };
  }
}
