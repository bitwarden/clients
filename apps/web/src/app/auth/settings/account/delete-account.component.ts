import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-delete-account",
  templateUrl: "delete-account.component.html",
})
export class DeleteAccountComponent {
  deleteForm = this.formBuilder.group({
    verification: undefined as Verification | undefined,
  });

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private dialogRef: DialogRef,
  ) {}

  submit = async () => {
    const verification = this.deleteForm.get("verification").value;
    await this.accountApiService.deleteAccount(verification);
    this.dialogRef.close();
    this.platformUtilsService.showToast(
      "success",
      this.i18nService.t("accountDeleted"),
      this.i18nService.t("accountDeletedDesc"),
    );
  };

  static openDeleteAccountDialog(dialogService: DialogService) {
    return dialogService.open(DeleteAccountComponent);
  }
}
