import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

/**
 * Used to verify the user's Master Password for the "Master Password Re-prompt" feature only.
 * See UserVerificationComponent for any other situation where you need to verify the user's identity.
 */
@Component({
  standalone: true,
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
  ) {}

  submit = async () => {
    const storedMasterKey = await this.keyService.getOrDeriveMasterKey(
      this.formGroup.value.masterPassword,
    );
    if (
      !(await this.keyService.compareAndUpdateKeyHash(
        this.formGroup.value.masterPassword,
        storedMasterKey,
      ))
    ) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidMasterPassword"),
      );
      return;
    }

    this.dialogRef.close(true);
  };
}
