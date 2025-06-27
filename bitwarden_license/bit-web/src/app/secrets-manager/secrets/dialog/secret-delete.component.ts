// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import { SecretListView } from "../../models/view/secret-list.view";
import {
  BulkOperationStatus,
  BulkStatusDetails,
  BulkStatusDialogComponent,
} from "../../shared/dialogs/bulk-status-dialog.component";
import { SecretService } from "../secret.service";

export interface SecretDeleteOperation {
  secrets: SecretListView[];
}

@Component({
  templateUrl: "./secret-delete.component.html",
  standalone: false,
})
export class SecretDeleteDialogComponent {
  constructor(
    public dialogRef: DialogRef,
    private secretService: SecretService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    @Inject(DIALOG_DATA) private data: SecretDeleteOperation,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  showSoftDeleteSecretWarning = this.data.secrets.length === 1;

  get title() {
    return this.data.secrets.length === 1 ? "deleteSecret" : "deleteSecrets";
  }

  get submitButtonText() {
    return this.data.secrets.length === 1 ? "deleteSecret" : "deleteSecrets";
  }

  delete = async () => {
    const bulkResponses = await this.secretService.delete(this.data.secrets);

    if (bulkResponses.find((response) => response.errorMessage)) {
      this.openBulkStatusDialog(bulkResponses.filter((response) => response.errorMessage));
      this.dialogRef.close(true);
      return;
    }

    const message =
      this.data.secrets.length === 1 ? "softDeleteSuccessToast" : "softDeletesSuccessToast";
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });

    this.dialogRef.close(true);
  };

  openBulkStatusDialog(bulkStatusResults: BulkOperationStatus[]) {
    this.dialogService.open<unknown, BulkStatusDetails>(BulkStatusDialogComponent, {
      data: {
        title: "deleteSecrets",
        subTitle: "secrets",
        columnTitle: "name",
        message: "bulkDeleteSecretsErrorMessage",
        details: bulkStatusResults,
      },
    });
  }
}
