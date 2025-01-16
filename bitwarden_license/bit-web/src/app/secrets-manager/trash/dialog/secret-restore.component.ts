// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { SecretService } from "../../secrets/secret.service";

export interface SecretRestoreOperation {
  secretIds: string[];
  organizationId: string;
}

@Component({
  templateUrl: "./secret-restore.component.html",
})
export class SecretRestoreDialogComponent {
  constructor(
    public dialogRef: DialogRef,
    private secretService: SecretService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    @Inject(DIALOG_DATA) public data: SecretRestoreOperation,
    private toastService: ToastService,
  ) {}

  get title() {
    return this.data.secretIds.length === 1 ? "restoreSecret" : "restoreSecrets";
  }

  restore = async () => {
    let message = "";
    await this.secretService.restoreTrashed(this.data.organizationId, this.data.secretIds);
    message =
      this.data.secretIds.length === 1
        ? "secretRestoredSuccessToast"
        : "secretsRestoredSuccessToast";
    this.dialogRef.close(this.data.secretIds);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });
  };
}
