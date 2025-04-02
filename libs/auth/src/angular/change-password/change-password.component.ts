import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { ChangePasswordService } from "@bitwarden/auth/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

@Component({
  standalone: true,
  selector: "auth-change-password",
  templateUrl: "change-password.component.html",
  imports: [InputPasswordComponent],
})
export class ChangePasswordComponent implements OnInit {
  @Input() inputPasswordFlow: InputPasswordFlow = InputPasswordFlow.ChangePassword;

  email?: string;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  userkeyRotationV2 = false;
  formPromise: Promise<any>;

  constructor(
    private accountService: AccountService,
    private changePasswordService: ChangePasswordService,
    private configService: ConfigService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private masterPasswordApiService: MasterPasswordApiService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private messagingService: MessagingService,
    private policyService: PolicyService,
    private toastService: ToastService,
    private syncService: SyncService,
  ) {}

  async ngOnInit() {
    this.userkeyRotationV2 = await this.configService.getFeatureFlag(FeatureFlag.UserKeyRotationV2);

    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(userId),
    );
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    if (this.userkeyRotationV2) {
      await this.submitNew(passwordInputResult);
    } else {
      await this.submitOld(passwordInputResult);
    }
  }

  async submitNew(passwordInputResult: PasswordInputResult) {
    try {
      if (passwordInputResult.rotateUserKey) {
        await this.syncService.fullSync(true);
        const user = await firstValueFrom(this.accountService.activeAccount$);

        await this.changePasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
          passwordInputResult.currentPassword,
          passwordInputResult.newPassword,
          user,
          passwordInputResult.newPasswordHint,
        );
      } else {
        await this.changePasswordService.changePassword(
          passwordInputResult.currentMasterKey,
          passwordInputResult.currentServerMasterKeyHash,
          passwordInputResult.newPasswordHint,
          passwordInputResult.newMasterKey,
          passwordInputResult.newServerMasterKeyHash,
        );

        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("masterPasswordChanged"),
          message: this.i18nService.t("masterPasswordChangedDesc"),
        });

        this.messagingService.send("logout");
      }
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e.message,
      });
    }
  }

  async submitOld(passwordInputResult: PasswordInputResult) {
    if (passwordInputResult.rotateUserKey) {
      await this.syncService.fullSync(true);
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      passwordInputResult.currentMasterKey,
      userId,
    );

    if (decryptedUserKey == null) {
      throw new Error("Could not decrypt user key");
    }

    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      passwordInputResult.newMasterKey,
      decryptedUserKey,
    );

    const request = new PasswordRequest();
    request.masterPasswordHash = passwordInputResult.currentServerMasterKeyHash;
    request.masterPasswordHint = passwordInputResult.newPasswordHint;
    request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;

    try {
      if (passwordInputResult.rotateUserKey) {
        this.formPromise = this.masterPasswordApiService.postPassword(request).then(async () => {
          // we need to save this for local masterkey verification during rotation
          await this.masterPasswordService.setMasterKeyHash(
            passwordInputResult.newLocalMasterKeyHash,
            userId as UserId,
          );
          await this.masterPasswordService.setMasterKey(
            passwordInputResult.newMasterKey,
            userId as UserId,
          );
          return this.updateKey(passwordInputResult.newPassword);
        });
      } else {
        this.formPromise = this.masterPasswordApiService.postPassword(request);
      }

      await this.formPromise;

      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("masterPasswordChanged"),
        message: this.i18nService.t("logBackIn"),
      });
      this.messagingService.send("logout");
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  private async updateKey(newPassword: string) {
    const user = await firstValueFrom(this.accountService.activeAccount$);
    await this.changePasswordService.rotateUserKeyAndEncryptedDataLegacy(newPassword, user);
  }
}
