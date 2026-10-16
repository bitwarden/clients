// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { BulkOperationStatus } from "@bitwarden/bit-common/secrets-manager/models/bulk-operation-status";
import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import {
  BulkStatusDetails,
  BulkStatusDialogComponent,
} from "../../shared/dialogs/bulk-status-dialog.component";

export interface SecretDeleteOperation {
  secrets: SecretListView[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
      await this.dialogRef.close(true);
      return;
    }

    const message =
      this.data.secrets.length === 1 ? "softDeleteSuccessToast" : "softDeletesSuccessToast";
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });

    await this.dialogRef.close(true);
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
