import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";

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
        await this.updatePassword(passwordInputResult.newPassword);
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

  async updatePassword(password: string) {}
}
