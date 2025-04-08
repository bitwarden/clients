import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ChangePasswordService } from "@bitwarden/auth/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
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

  activeAccount: Account | null = null;
  email?: string;
  userId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  userkeyRotationV2 = false;
  formPromise?: Promise<any>;

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

    this.activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    this.userId = this.activeAccount?.id;
    this.email = this.activeAccount?.email;

    if (this.userId == null) {
      throw new Error("UserId cannot be null");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.userId),
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
    if (
      passwordInputResult.currentPassword == null ||
      passwordInputResult.currentMasterKey == null ||
      passwordInputResult.currentServerMasterKeyHash == null
    ) {
      throw new Error("Invalid current password credentials");
    }

    try {
      if (passwordInputResult.rotateUserKey) {
        await this.syncService.fullSync(true);

        if (this.activeAccount == null) {
          throw new Error("User not found");
        }

        await this.changePasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
          passwordInputResult.currentPassword,
          passwordInputResult.newPassword,
          this.activeAccount,
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
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async submitOld(passwordInputResult: PasswordInputResult) {
    if (passwordInputResult.currentServerMasterKeyHash == null) {
      throw new Error("Invalid current password credentials");
    }

    if (passwordInputResult.rotateUserKey) {
      await this.syncService.fullSync(true);
    }

    let newMasterKeyEncryptedUserKey: [UserKey, EncString] | null = null;

    const userKey = await this.keyService.getUserKey();
    if (userKey == null) {
      newMasterKeyEncryptedUserKey = await this.keyService.makeUserKey(
        passwordInputResult.newMasterKey,
      );
    } else {
      newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
        passwordInputResult.newMasterKey,
      );
    }

    const request = new PasswordRequest();
    request.masterPasswordHash = passwordInputResult.currentServerMasterKeyHash;
    request.masterPasswordHint = passwordInputResult.newPasswordHint;
    request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString as string;

    try {
      if (passwordInputResult.rotateUserKey) {
        this.formPromise = this.masterPasswordApiService.postPassword(request).then(async () => {
          // we need to save this for local masterkey verification during rotation
          await this.masterPasswordService.setMasterKeyHash(
            passwordInputResult.newLocalMasterKeyHash,
            this.userId as UserId,
          );
          await this.masterPasswordService.setMasterKey(
            passwordInputResult.newMasterKey,
            this.userId as UserId,
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
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  private async updateKey(newPassword: string) {
    if (this.activeAccount == null) {
      throw new Error("User not found");
    }

    await this.changePasswordService.rotateUserKeyAndEncryptedDataLegacy(
      newPassword,
      this.activeAccount,
    );
  }
}
