import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService, Translation } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";
import { LockIcon } from "../icons";
import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

import { ChangePasswordService } from "./change-password.service.abstraction";

@Component({
  standalone: true,
  selector: "auth-change-password",
  templateUrl: "change-password.component.html",
  imports: [InputPasswordComponent, I18nPipe],
})
export class ChangePasswordComponent implements OnInit {
  @Input() inputPasswordFlow: InputPasswordFlow = InputPasswordFlow.ChangePassword;

  activeAccount: Account | null = null;
  email?: string;
  activeUserId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  initializing = true;
  submitting = false;
  formPromise?: Promise<any>;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  warningText?: Translation;

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
  ) {}

  async ngOnInit() {
    this.activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    this.activeUserId = this.activeAccount?.id;
    this.email = this.activeAccount?.email;

    if (!this.activeUserId) {
      throw new Error("userId not found");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.activeUserId),
    );

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.activeUserId),
    );

    this.initializing = false;

    if (this.masterPasswordPolicyOptions?.enforceOnLogin) {
      this.warningText = { key: "masterPasswordInvalidWarning" };
    }

    if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "accountRecoveryUpdateMasterPasswordSubtitle" },
        hideFooter: true,
        maxWidth: "lg",
      });
    } else if (this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "updateMasterPasswordSubtitle" },
        hideFooter: true,
        maxWidth: "lg",
      });
    }
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
        if (!this.activeUserId) {
          throw new Error("userId not found");
        }

        if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
          await this.changePasswordService.changePasswordForAccountRecovery(
            passwordInputResult,
            this.activeUserId,
          );
        } else {
          await this.changePasswordService.changePassword(passwordInputResult, this.activeUserId);
        }

        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("masterPasswordChanged"),
          message: this.i18nService.t("masterPasswordChangedDesc"),
        });

        this.messagingService.send("logout");
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.submitting = false;
    }
  }
}
