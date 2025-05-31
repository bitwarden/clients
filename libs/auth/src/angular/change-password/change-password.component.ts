import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";
import { LockIcon } from "../icons";
import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

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
  standalone: true,
  selector: "auth-change-password",
  templateUrl: "change-password.component.html",
  imports: [InputPasswordComponent, I18nPipe],
})
export class ChangePasswordComponent implements OnInit {
  @Input() inputPasswordFlow: InputPasswordFlow = InputPasswordFlow.ChangePassword;

  activeAccount: Account | null = null;
  email!: string;
  userId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  initializing = true;
  submitting = false;
  formPromise?: Promise<any>;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  constructor(
    private accountService: AccountService,
    private changePasswordService: ChangePasswordService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
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
      throw new Error("activeUserId not found");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.userId),
    );

    /**
     * In the event of the org invitation flow, this will always be ForceSetPasswordReason.None
     * because the `password-login.strategy` short circuits before setting the force set password
     * reason. We used to have two separate components, update-temp-password and update-password
     * which could show discrete messages based on the flow, but we cannot do that with one shared
     * component. I cannot use the AcceptOrganizationInviteService to determine if we have an org
     * invite so how can I determine that?
     */
    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "accountRecoveryUpdateMasterPasswordSubtitle" },
      });
    } else if (this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
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

        if (passwordInputResult.currentPassword == null) {
          throw new Error("currentPassword not found");
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
          title: this.i18nService.t("masterPasswordChanged"),
          message: this.i18nService.t("masterPasswordChangedDesc"),
        });

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

  protected readonly ForceSetPasswordReason = ForceSetPasswordReason;
}
