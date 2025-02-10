// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

@Component({
  templateUrl: "delete-account-dialog.component.html",
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
