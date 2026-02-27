import { CommonModule } from "@angular/common";
import { Component, Inject, ViewChild } from "@angular/core";
import { switchMap } from "rxjs";

import { InputPasswordComponent, InputPasswordFlow } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
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
  organizationUserId: string;

  /**
   * The organization's `organizationId`
   */
  organizationId: OrganizationId;
};

export const AccountRecoveryDialogResultType = {
  Ok: "ok",
} as const;

export type AccountRecoveryDialogResultType =
  (typeof AccountRecoveryDialogResultType)[keyof typeof AccountRecoveryDialogResultType];

/**
 * Used in a dialog for initiating the account recovery process against a
 * given organization user. An admin will access this form when they want to
 * reset a user's password and log them out of sessions.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "app-account-recovery-dialog",
  templateUrl: "account-recovery-dialog.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    DialogModule,
    I18nPipe,
    InputPasswordComponent,
  ],
})
export class AccountRecoveryDialogComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(InputPasswordComponent)
  inputPasswordComponent: InputPasswordComponent | undefined = undefined;

  masterPasswordPolicyOptions$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.masterPasswordPolicyOptions$(userId)),
  );

  inputPasswordFlow = InputPasswordFlow.ChangePasswordDelegation;

  get loggedOutWarningName() {
    return this.dialogData.name != null ? this.dialogData.name : this.i18nService.t("thisUser");
  }

  constructor(
    @Inject(DIALOG_DATA) protected dialogData: AccountRecoveryDialogData,
    private accountService: AccountService,
    private dialogRef: DialogRef<AccountRecoveryDialogResultType>,
    private i18nService: I18nService,
    private policyService: PolicyService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private toastService: ToastService,
  ) {}

  handlePrimaryButtonClick = async () => {
    if (!this.inputPasswordComponent) {
      throw new Error("InputPasswordComponent is not initialized");
    }

    const passwordInputResult = await this.inputPasswordComponent.submit();
    if (!passwordInputResult) {
      return;
    }

    await this.resetPasswordService.resetMasterPassword(
      passwordInputResult.newPassword,
      this.dialogData.email,
      this.dialogData.organizationUserId,
      this.dialogData.organizationId,
    );

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("resetPasswordSuccess"),
    });

    this.dialogRef.close(AccountRecoveryDialogResultType.Ok);
  };

  /**
   * Strongly typed helper to open an `AccountRecoveryDialogComponent`
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param dialogConfig Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<
      AccountRecoveryDialogData,
      DialogRef<AccountRecoveryDialogResultType, unknown>
    >,
  ) => {
    return dialogService.open<AccountRecoveryDialogResultType, AccountRecoveryDialogData>(
      AccountRecoveryDialogComponent,
      dialogConfig,
    );
  };
}
