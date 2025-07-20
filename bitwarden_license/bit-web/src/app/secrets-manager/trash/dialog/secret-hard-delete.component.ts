// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { SecretService } from "../../secrets/secret.service";

export interface SecretHardDeleteOperation {
  secretIds: string[];
  organizationId: string;
}

@Component({
  templateUrl: "./secret-hard-delete.component.html",
  standalone: false,
})
export class SecretHardDeleteDialogComponent {
  constructor(
    public dialogRef: DialogRef,
    private secretService: SecretService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    @Inject(DIALOG_DATA) public data: SecretHardDeleteOperation,
    private toastService: ToastService,
  ) {}

  get title() {
    return this.data.secretIds.length === 1 ? "hardDeleteSecret" : "hardDeleteSecrets";
  }

  get submitButtonText() {
    return this.data.secretIds.length === 1 ? "deleteSecret" : "deleteSecrets";
  }

  delete = async () => {
    await this.secretService.deleteTrashed(this.data.organizationId, this.data.secretIds);
    const message =
      this.data.secretIds.length === 1 ? "hardDeleteSuccessToast" : "hardDeletesSuccessToast";
    this.dialogRef.close(this.data.secretIds);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });
  };
}
