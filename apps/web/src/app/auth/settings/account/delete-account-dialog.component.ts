// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "delete-account-dialog.component.html",
  imports: [SharedModule, UserVerificationFormInputComponent],
})
export class DeleteAccountDialogComponent {
  deleteForm = this.formBuilder.group({
    verification: undefined as Verification | undefined,
  });
  invalidSecret: boolean = false;

  constructor(
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private dialogRef: DialogRef,
    private toastService: ToastService,
  ) {}

  submit = async () => {
    try {
      const verification = this.deleteForm.get("verification").value;
      await this.accountApiService.deleteAccount(verification);
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("accountDeleted"),
        message: this.i18nService.t("accountDeletedDesc"),
      });
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 400) {
        this.invalidSecret = true;
      }
      throw e;
    }
  };

  static open(dialogService: DialogService) {
    return dialogService.open(DeleteAccountDialogComponent);
  }
}
