import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
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
  InputPasswordFlow = InputPasswordFlow;

  email?: string;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  userkeyRotationV2 = false;

  constructor(
    private accountService: AccountService,
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

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));

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
      if (passwordInputResult.rotateAccountEncryptionKey) {
        await this.syncService.fullSync(true);
        // const user = await firstValueFrom(this.accountService.activeAccount$);
        // // TODO-rr-bw: make a ChangeExistingPasswordService with Default & Web implementations
        // // await this.changeExistingPasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
        // //   passwordInputResult.currentPassword,
        // //   passwordInputResult.newPassword,
        // //   user,
        // //   passwordInputResult.hint,
        // // );
      } else {
        await this.updatePassword(
          passwordInputResult.currentPassword,
          passwordInputResult.newPassword,
          passwordInputResult.hint,
        );
      }
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e.message,
      });
    }
  }

  async submitOld(passwordInputResult: PasswordInputResult) {}

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
}
