// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { SecretService } from "../../secrets/secret.service";

export interface SecretRestoreOperation {
  secretIds: string[];
  organizationId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./secret-restore.component.html",
  standalone: false,
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
