import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

/**
 * Used to verify the user's Master Password for the "Master Password Re-prompt" feature only.
 * See UserVerificationComponent for any other situation where you need to verify the user's identity.
 */
@Component({
  selector: "vault-password-reprompt",
  imports: [
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: "password-reprompt.component.html",
})
export class PasswordRepromptComponent {
  formGroup = this.formBuilder.group({
    masterPassword: ["", { validators: [Validators.required], updateOn: "submit" }],
  });

  constructor(
    protected keyService: KeyService,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected formBuilder: FormBuilder,
    protected dialogRef: DialogRef,
    private toastService: ToastService,
    protected accountService: AccountService,
  ) {}

  submit = async () => {
    // Exit early when a master password is not provided.
    // The form field required error will be shown to users in these cases.
    if (!this.formGroup.value.masterPassword) {
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (userId == null) {
      throw new Error("An active user is expected while doing password reprompt.");
    }

    const storedMasterKey = await this.keyService.getOrDeriveMasterKey(
      this.formGroup.value.masterPassword,
      userId,
    );
    if (
      !(await this.keyService.compareKeyHash(
        this.formGroup.value.masterPassword,
        storedMasterKey,
        userId,
      ))
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    this.dialogRef.close(true);
  };
}
