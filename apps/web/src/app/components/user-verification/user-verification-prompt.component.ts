import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { UserVerificationPromptComponent as BaseUserVerificationPrompt } from "@bitwarden/angular/auth/components/user-verification-prompt.component";
import { ModalConfig } from "@bitwarden/angular/services/modal.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { UserVerificationService } from "@bitwarden/common/abstractions/userVerification/userVerification.service.abstraction";

import { DialogServiceAbstraction } from "../../../../../../libs/angular/src/services/dialog";

export interface UserVerificationPromptParams {
  confirmDescription: string;
  confirmButtonText: string;
  modalTitle: string;
}

@Component({
  templateUrl: "user-verification-prompt.component.html",
})
export class UserVerificationPromptComponent extends BaseUserVerificationPrompt {
  constructor(
    @Inject(DIALOG_DATA) data: UserVerificationPromptParams,
    private dialogRef: DialogRef<boolean>,
    userVerificationService: UserVerificationService,
    formBuilder: FormBuilder,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService
  ) {
    // TODO: Remove when BaseUserVerificationPrompt has support for CL
    const modalConfig: ModalConfig = { data };
    super(
      null,
      modalConfig,
      userVerificationService,
      formBuilder,
      platformUtilsService,
      i18nService
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
  dialogService: DialogServiceAbstraction,
  config: DialogConfig<UserVerificationPromptParams>
) => {
  return dialogService.open<boolean, UserVerificationPromptParams>(
    UserVerificationPromptComponent,
    config
  );
};
