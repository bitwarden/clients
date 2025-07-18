import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  InputPasswordComponent,
  InputPasswordFlow,
  PasswordInputResult,
} from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  DialogService,
  ToastService,
  Icons,
  CalloutComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ChangePasswordService } from "./change-password.service.abstraction";

/**
 * Change Password Component
 *
 * NOTE: The change password component uses the input-password component which will show the
 * current password input form in some flows, although it could be left off. This is intentional
 * and by design to maintain a strong security posture as some flows could have the user
 * end up at a change password without having one before.
 */
@Component({
  selector: "auth-change-password",
  templateUrl: "change-password.component.html",
  imports: [InputPasswordComponent, I18nPipe, CalloutComponent, CommonModule],
})
export class ChangePasswordComponent implements OnInit {
  @Input() inputPasswordFlow: InputPasswordFlow = InputPasswordFlow.ChangePassword;

  activeAccount: Account | null = null;
  email?: string;
  userId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  initializing = true;
  submitting = false;
  formPromise?: Promise<any>;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  protected readonly ForceSetPasswordReason = ForceSetPasswordReason;

  constructor(
    private accountService: AccountService,
    private changePasswordService: ChangePasswordService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private organizationInviteService: OrganizationInviteService,
    private messagingService: MessagingService,
    private policyService: PolicyService,
    private toastService: ToastService,
    private syncService: SyncService,
    private dialogService: DialogService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    this.activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    if (!this.activeAccount) {
      throw new Error("No active active account found while trying to change passwords.");
    }

    this.userId = this.activeAccount.id;
    this.email = this.activeAccount.email;

    if (!this.userId) {
      throw new Error("userId not found");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.userId),
    );

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: Icons.LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "accountRecoveryUpdateMasterPasswordSubtitle" },
      });
    } else if (this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: Icons.LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "updateMasterPasswordSubtitle" },
        maxWidth: "lg",
      });
    }

    this.initializing = false;
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    if (confirmed) {
      await this.organizationInviteService.clearOrganizationInvitation();

      if (this.changePasswordService.clearDeeplinkState) {
        await this.changePasswordService.clearDeeplinkState();
      }

      // TODO: PM-23515 eventually use the logout service instead of messaging service once it is available without circular dependencies
      this.messagingService.send("logout");
    }
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    try {
      if (passwordInputResult.rotateUserKey) {
        if (this.activeAccount == null) {
          throw new Error("activeAccount not found");
        }

        if (
          passwordInputResult.currentPassword == null ||
          passwordInputResult.newPasswordHint == null
        ) {
          throw new Error("currentPassword or newPasswordHint not found");
        }

        await this.syncService.fullSync(true);

        await this.changePasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
          passwordInputResult.currentPassword,
          passwordInputResult.newPassword,
          this.activeAccount,
          passwordInputResult.newPasswordHint,
        );
      } else {
        if (!this.userId) {
          throw new Error("userId not found");
        }

        if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
          await this.changePasswordService.changePasswordForAccountRecovery(
            passwordInputResult,
            this.userId,
          );
        } else {
          await this.changePasswordService.changePassword(passwordInputResult, this.userId);
        }

        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("masterPasswordChanged"),
        });

        // TODO: PM-23515 eventually use the logout service instead of messaging service once it is available without circular dependencies
        this.messagingService.send("logout");
      }
    } catch (error) {
      this.logService.error(error);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.submitting = false;
    }
  }

  /**
   * Shows the logout button in the case of admin force reset password or weak password upon login.
   */
  protected secondaryButtonText(): { key: string } | undefined {
    return this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset ||
      this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword
      ? { key: "logOut" }
      : undefined;
  }
}
