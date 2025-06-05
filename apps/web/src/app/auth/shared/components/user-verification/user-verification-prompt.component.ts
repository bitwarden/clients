// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import {
  UserVerificationPromptComponent as BaseUserVerificationPrompt,
  UserVerificationPromptParams,
} from "@bitwarden/angular/auth/components/user-verification-prompt.component";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogConfig,
  DialogRef,
  DIALOG_DATA,
  DialogService,
  ToastService,
} from "@bitwarden/components";

/**
 * @deprecated Jan 24, 2024: Use new libs/auth UserVerificationDialogComponent instead.
 */
@Component({
  templateUrl: "user-verification-prompt.component.html",
  standalone: false,
})
export class UserVerificationPromptComponent extends BaseUserVerificationPrompt {
  constructor(
    @Inject(DIALOG_DATA) data: UserVerificationPromptParams,
    private dialogRef: DialogRef<boolean>,
    userVerificationService: UserVerificationService,
    formBuilder: FormBuilder,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    toastService: ToastService,
  ) {
    super(
      null,
      data,
      userVerificationService,
      formBuilder,
      platformUtilsService,
      i18nService,
      toastService,
    );
  }

  override close(success: boolean) {
    this.dialogRef.close(success);
  }
}

/**
 * Strongly typed helper to open a UserVerificationPrompt
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openUserVerificationPrompt = (
  dialogService: DialogService,
  config: DialogConfig<UserVerificationPromptParams>,
) => {
  return dialogService.open<boolean, UserVerificationPromptParams>(
    UserVerificationPromptComponent,
    config,
  );
};
