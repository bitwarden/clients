import { AsyncPipe, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, viewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, of, switchMap } from "rxjs";

import { InputPasswordComponent, InputPasswordFlow } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

import {
  AccountRecoveryDialogData,
  AccountRecoveryDialogResultType,
} from "./account-recovery-dialog.component";

/**
 * V2 account recovery dialog shown when the AdminResetTwoFactor feature flag is enabled.
 * Supports selectively resetting master password, two-step login, or both.
 */
@Component({
  standalone: true,
  selector: "app-account-recovery-dialog-v2",
  templateUrl: "account-recovery-dialog-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    AsyncPipe,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    FormFieldModule,
    NgIf,
    ReactiveFormsModule,
    I18nPipe,
    InputPasswordComponent,
  ],
})
export class AccountRecoveryDialogV2Component {
  protected readonly inputPasswordComponent = viewChild(InputPasswordComponent);

  /** True when the target user is exempt from policies (Admin or Owner role). */
  private readonly targetUserExemptFromPolicies =
    this.dialogData.organizationUserType === OrganizationUserType.Owner ||
    this.dialogData.organizationUserType === OrganizationUserType.Admin;

  readonly masterPasswordPolicyOptions$ = this.targetUserExemptFromPolicies
    ? of(undefined)
    : this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policies$(userId).pipe(
            map((policies) =>
              policies.filter(
                (p) =>
                  p.type === PolicyType.MasterPassword &&
                  p.enabled &&
                  p.organizationId === this.dialogData.organizationId,
              ),
            ),
            switchMap((policies) =>
              this.policyService.masterPasswordPolicyOptions$(userId, policies),
            ),
          ),
        ),
      );

  /** True when the org has the Require Two-Step Login policy enabled and the target user is subject to it. */
  readonly twoFactorPolicyEnabled$ = this.targetUserExemptFromPolicies
    ? of(false)
    : this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.policyService.policies$(userId)),
        map((policies) =>
          policies.some(
            (p) =>
              p.type === PolicyType.TwoFactorAuthentication &&
              p.enabled &&
              p.organizationId === this.dialogData.organizationId,
          ),
        ),
      );

  readonly inputPasswordFlow = InputPasswordFlow.ChangePasswordDelegation;

  protected readonly form = this.formBuilder.group({
    resetMasterPassword: [true],
    resetTwoFactor: [{ value: false, disabled: !this.dialogData.twoFactorEnabled }],
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly dialogData: AccountRecoveryDialogData,
    private readonly accountService: AccountService,
    private readonly dialogRef: DialogRef<AccountRecoveryDialogResultType>,
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly policyService: PolicyService,
    private readonly resetPasswordService: OrganizationUserResetPasswordService,
    private readonly toastService: ToastService,
  ) {}

  readonly handlePrimaryButtonClick = async () => {
    const { resetMasterPassword, resetTwoFactor } = this.form.value;
    let newPassword: string | undefined;

    if (resetMasterPassword) {
      const inputPasswordComponent = this.inputPasswordComponent();
      if (!inputPasswordComponent) {
        throw new Error("InputPasswordComponent is not initialized");
      }

      const passwordInputResult = await inputPasswordComponent.submit();
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

    await this.dialogRef.close(AccountRecoveryDialogResultType.Ok);
  };

  /**
   * Strongly typed helper to open an `AccountRecoveryDialogV2Component`
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param dialogConfig Configuration for the dialog
   */
  static readonly open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<AccountRecoveryDialogData, AccountRecoveryDialogResultType>,
  ) => {
    return dialogService.open<AccountRecoveryDialogResultType, AccountRecoveryDialogData>(
      AccountRecoveryDialogV2Component,
      dialogConfig,
    );
  };
}
