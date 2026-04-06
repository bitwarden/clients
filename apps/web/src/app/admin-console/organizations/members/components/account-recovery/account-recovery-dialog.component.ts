import { CommonModule } from "@angular/common";
import { Component, Inject, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, switchMap } from "rxjs";

import { InputPasswordComponent, InputPasswordFlow } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
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
 * given organization user. An admin can reset the user's master password,
 * two-step login, or both, then log them out of sessions.
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
    CheckboxModule,
    CommonModule,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
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

  /** True when the org has the Require Two-Step Login policy enabled. */
  twoFactorPolicyEnabled$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.TwoFactorAuthentication, userId),
    ),
    map((policies) => policies.some((p) => p.organizationId === this.dialogData.organizationId)),
  );

  adminResetTwoFactorEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.AdminResetTwoFactor);

  inputPasswordFlow = InputPasswordFlow.ChangePasswordDelegation;

  protected form = this.formBuilder.group({
    resetMasterPassword: [true],
    resetTwoFactor: [false],
  });

  constructor(
    @Inject(DIALOG_DATA) protected dialogData: AccountRecoveryDialogData,
    private accountService: AccountService,
    private configService: ConfigService,
    private dialogRef: DialogRef<AccountRecoveryDialogResultType>,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private policyService: PolicyService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private toastService: ToastService,
  ) {}

  handlePrimaryButtonClick = async () => {
    const { resetMasterPassword, resetTwoFactor } = this.form.value;
    let newPassword: string | undefined;

    if (resetMasterPassword) {
      if (!this.inputPasswordComponent) {
        throw new Error("InputPasswordComponent is not initialized");
      }

      const passwordInputResult = await this.inputPasswordComponent.submit();
      if (!passwordInputResult) {
        return;
      }
      newPassword = passwordInputResult.newPassword;
    }

    await this.resetPasswordService.recoverAccount({
      organizationUserId: this.dialogData.organizationUserId,
      organizationId: this.dialogData.organizationId,
      resetMasterPassword: resetMasterPassword ?? false,
      resetTwoFactor: resetTwoFactor ?? false,
      newMasterPassword: newPassword,
      email: this.dialogData.email,
    });

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("recoverAccountSuccess"),
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
