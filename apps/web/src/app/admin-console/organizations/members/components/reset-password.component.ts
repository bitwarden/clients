// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { PasswordStrengthV2Component } from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { OrganizationUserResetPasswordService } from "../services/organization-user-reset-password/organization-user-reset-password.service";

/**
 * Encapsulates a few key data inputs needed to initiate an account recovery
 * process for the organization user in question.
 */
export type ResetPasswordDialogData = {
  /**
   * The organization user's full name
   */
  name: string;

  /**
   * The organization user's email address
   */
  email: string;

  /**
   * The `organizationUserId` for the user
   */
  id: string;

  /**
   * The organization's `organizationId`
   */
  organizationId: string;
};

export enum ResetPasswordDialogResult {
  Ok = "ok",
}

@Component({
  selector: "app-reset-password",
  templateUrl: "reset-password.component.html",
})
/**
 * Used in a dialog for initiating the account recovery process against a
 * given organization user. An admin will access this form when they want to
 * reset a user's password and log them out of sessions.
 */
export class ResetPasswordComponent implements OnInit, OnDestroy {
  formGroup = this.formBuilder.group({
    newPassword: ["", Validators.required],
  });

  @ViewChild(PasswordStrengthV2Component) passwordStrengthComponent: PasswordStrengthV2Component;

  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  showPassword = false;
  passwordStrengthScore: number;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) protected data: ResetPasswordDialogData,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private policyService: PolicyService,
    private logService: LogService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<ResetPasswordDialogResult>,
  ) {}

  async ngOnInit() {
    this.policyService
      .masterPasswordPolicyOptions$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (enforcedPasswordPolicyOptions) =>
          (this.enforcedPolicyOptions = enforcedPasswordPolicyOptions),
      );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get loggedOutWarningName() {
    return this.data.name != null ? this.data.name : this.i18nService.t("thisUser");
  }

  async generatePassword() {
    const options = (await this.passwordGenerationService.getOptions())?.[0] ?? {};
    this.formGroup.patchValue({
      newPassword: await this.passwordGenerationService.generatePassword(options),
    });
    this.passwordStrengthComponent.updatePasswordStrength(this.formGroup.value.newPassword);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    document.getElementById("newPassword").focus();
  }

  copy() {
    const value = this.formGroup.value.newPassword;
    if (value == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("password")),
    });
  }

  submit = async () => {
    // Validation
    if (this.formGroup.value.newPassword == null || this.formGroup.value.newPassword === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return false;
    }

    if (this.formGroup.value.newPassword.length < Utils.minimumPasswordLength) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordMinlength", Utils.minimumPasswordLength),
      });
      return false;
    }

    if (
      this.enforcedPolicyOptions != null &&
      !this.policyService.evaluateMasterPassword(
        this.passwordStrengthScore,
        this.formGroup.value.newPassword,
        this.enforcedPolicyOptions,
      )
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordPolicyRequirementsNotMet"),
      });
      return;
    }

    if (this.passwordStrengthScore < 3) {
      const result = await this.dialogService.openSimpleDialog({
        title: { key: "weakMasterPassword" },
        content: { key: "weakMasterPasswordDesc" },
        type: "warning",
      });

      if (!result) {
        return false;
      }
    }

    try {
      await this.resetPasswordService.resetMasterPassword(
        this.formGroup.value.newPassword,
        this.data.email,
        this.data.id,
        this.data.organizationId,
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("resetPasswordSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.dialogRef.close(ResetPasswordDialogResult.Ok);
  };

  getStrengthScore(result: number) {
    this.passwordStrengthScore = result;
  }

  static open = (dialogService: DialogService, input: DialogConfig<ResetPasswordDialogData>) => {
    return dialogService.open<ResetPasswordDialogResult>(ResetPasswordComponent, input);
  };
}
