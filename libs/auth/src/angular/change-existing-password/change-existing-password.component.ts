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
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

@Component({
  standalone: true,
  selector: "auth-change-existing-password",
  templateUrl: "change-existing-password.component.html",
  imports: [InputPasswordComponent],
})
export class ChangeExistingPasswordComponent implements OnInit {
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
    private kdfConfigService: KdfConfigService,
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
    const { currentPassword, newPassword, hint, rotateUserKey } = passwordInputResult;

    try {
      if (rotateUserKey) {
        await this.syncService.fullSync(true);
        const user = await firstValueFrom(this.accountService.activeAccount$);

        await this.changePasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
          currentPassword,
          newPassword,
          user,
          hint,
        );
      } else {
        await this.updatePassword(currentPassword, newPassword, hint);
      }
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e.message,
      });
    }
  }

  // todo: move this to a service
  // https://bitwarden.atlassian.net/browse/PM-17108
  async updatePassword(currentPassword: string, newPassword: string, hint: string) {
    const { userId, email } = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => ({ userId: a?.id, email: a?.email }))),
    );
    const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));

    const currentMasterKey = await this.keyService.makeMasterKey(currentPassword, email, kdfConfig);
    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      currentMasterKey,
      userId,
    );
    if (decryptedUserKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const newMasterKey = await this.keyService.makeMasterKey(newPassword, email, kdfConfig);
    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      decryptedUserKey,
    );

    const request = new PasswordRequest();
    request.masterPasswordHash = await this.keyService.hashMasterKey(
      currentPassword,
      currentMasterKey,
    );
    request.masterPasswordHint = hint;
    request.newMasterPasswordHash = await this.keyService.hashMasterKey(newPassword, newMasterKey);
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;

    try {
      await this.masterPasswordApiService.postPassword(request);

      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("masterPasswordChanged"),
        message: this.i18nService.t("masterPasswordChangedDesc"),
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

  async submitOld(passwordInputResult: PasswordInputResult) {
    if (passwordInputResult.rotateUserKey) {
      await this.syncService.fullSync(true);
    }

    const masterKey = await this.keyService.makeMasterKey(
      passwordInputResult.currentPassword,
      await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email))),
      await this.kdfConfigService.getKdfConfig(),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const newLocalKeyHash = await this.keyService.hashMasterKey(
      passwordInputResult.newPassword,
      passwordInputResult.newMasterKey,
      HashPurpose.LocalAuthorization,
    );

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(masterKey, userId);
    if (userKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const request = new PasswordRequest();
    request.masterPasswordHash = await this.keyService.hashMasterKey(
      passwordInputResult.currentPassword,
      masterKey,
    );
    request.masterPasswordHint = passwordInputResult.hint;
    request.newMasterPasswordHash = passwordInputResult.serverMasterKeyHash;
    // request.key = newUserKey[1].encryptedString;

    try {
      if (passwordInputResult.rotateUserKey) {
        this.formPromise = this.masterPasswordApiService.postPassword(request).then(async () => {
          // we need to save this for local masterkey verification during rotation
          await this.masterPasswordService.setMasterKeyHash(newLocalKeyHash, userId as UserId);
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
