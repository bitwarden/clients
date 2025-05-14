import { Component, Inject, OnInit, ViewChild } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  InputPasswordComponent,
  InputPasswordFlow,
  PasswordInputResult,
} from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationUserResetPasswordService } from "../../services/organization-user-reset-password/organization-user-reset-password.service";

/**
 * Encapsulates a few key data inputs needed to initiate an account recovery
 * process for the organization user in question.
 */
export type AccountRecoveryDialogData = {
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

export const AccountRecoveryDialogResultTypes = {
  Ok: "ok",
} as const;

type AccountRecoveryDialogResultType =
  (typeof AccountRecoveryDialogResultTypes)[keyof typeof AccountRecoveryDialogResultTypes];

/**
 * Used in a dialog for initiating the account recovery process against a
 * given organization user. An admin will access this form when they want to
 * reset a user's password and log them out of sessions.
 */
@Component({
  standalone: true,
  selector: "app-account-recovery-dialog",
  templateUrl: "account-recovery-dialog.component.html",
  imports: [ButtonModule, CalloutModule, DialogModule, I18nPipe, InputPasswordComponent],
})
export class AccountRecoveryDialogComponent implements OnInit {
  @ViewChild(InputPasswordComponent)
  inputPasswordComponent: InputPasswordComponent;

  inputPasswordFlow = InputPasswordFlow.ChangePasswordDelegation;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;

  get loggedOutWarningName() {
    return this.dialogData.name != null ? this.dialogData.name : this.i18nService.t("thisUser");
  }

  constructor(
    @Inject(DIALOG_DATA) protected dialogData: AccountRecoveryDialogData,
    private accountService: AccountService,
    private dialogRef: DialogRef<AccountRecoveryDialogResultType>,
    private i18nService: I18nService,
    private logService: LogService,
    private policyService: PolicyService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(userId),
    );
  }

  submit = async () => {
    await this.inputPasswordComponent.submit();
  };

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    try {
      await this.resetPasswordService.resetMasterPassword(
        passwordInputResult.newPassword,
        this.dialogData.email,
        this.dialogData.id,
        this.dialogData.organizationId,
      );

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("resetPasswordSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.dialogRef.close(AccountRecoveryDialogResultTypes.Ok);
  }

  /**
   * Strongly typed helper to open an `AccountRecoveryDialogComponent`
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param dialogConfig Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<AccountRecoveryDialogData>,
  ) => {
    return dialogService.open<AccountRecoveryDialogResultType>(
      AccountRecoveryDialogComponent,
      dialogConfig,
    );
  };
}
