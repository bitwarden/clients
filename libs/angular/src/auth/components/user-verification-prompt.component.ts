// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { ModalRef } from "../../components/modal/modal.ref";

export interface UserVerificationPromptParams {
  confirmDescription: string;
  confirmButtonText: string;
  modalTitle: string;
}

/**
 * Used to verify the user's identity (using their master password or email-based OTP for Key Connector users). You can customize all of the text in the modal.
 * @deprecated Jan 24, 2024: Use new libs/auth UserVerificationDialogComponent instead.
 */
@Directive()
export class UserVerificationPromptComponent {
  confirmDescription = this.config.confirmDescription;
  confirmButtonText = this.config.confirmButtonText;
  modalTitle = this.config.modalTitle;

  formGroup = this.formBuilder.group({
    secret: this.formBuilder.control<Verification | null>(null),
  });

  protected invalidSecret = false;

  constructor(
    private modalRef: ModalRef,
    protected config: UserVerificationPromptParams,
    protected userVerificationService: UserVerificationService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  get secret() {
    return this.formGroup.controls.secret;
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    try {
      //Incorrect secret will throw an invalid password error.
      await this.userVerificationService.verifyUser(this.secret.value);
      this.invalidSecret = false;
    } catch (e) {
      this.invalidSecret = true;
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: e.message,
      });
      return;
    }

    this.close(true);
  };

  close(success: boolean) {
    this.modalRef.close(success);
  }
}
