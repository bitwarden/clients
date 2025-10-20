// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { UserVerificationComponent } from "../app/components/user-verification.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "app-delete-account",
  templateUrl: "delete-account.component.html",
  imports: [
    JslibModule,
    UserVerificationComponent,
    ButtonModule,
    CalloutModule,
    AsyncActionsModule,
    DialogModule,
    ReactiveFormsModule,
  ],
})
export class DeleteAccountComponent {
  deleteForm = this.formBuilder.group({
    verification: undefined as VerificationWithSecret | undefined,
  });

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private toastService: ToastService,
  ) {}

  static open(dialogService: DialogService): DialogRef<DeleteAccountComponent> {
    return dialogService.open(DeleteAccountComponent);
  }

  get secret() {
    return this.deleteForm.get("verification")?.value?.secret;
  }

  submit = async () => {
    const verification = this.deleteForm.get("verification").value;
    await this.accountApiService.deleteAccount(verification);
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("accountDeleted"),
      message: this.i18nService.t("accountDeletedDesc"),
    });
  };
}
