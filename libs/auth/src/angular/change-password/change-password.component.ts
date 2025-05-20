import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
  userId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  initializing = true;
  submitting = false;

  constructor(
    private accountService: AccountService,
    private changePasswordService: ChangePasswordService,
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private policyService: PolicyService,
    private toastService: ToastService,
    private syncService: SyncService,
  ) {}

  async ngOnInit() {
    this.activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    this.userId = this.activeAccount?.id;
    this.email = this.activeAccount?.email;

    if (!this.userId) {
      throw new Error("userId not found");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.userId),
    );

    this.initializing = false;
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

        await this.changePasswordService.changePassword(passwordInputResult, this.userId);

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
