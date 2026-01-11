import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "deauthorize-sessions.component.html",
  imports: [SharedModule, UserVerificationFormInputComponent],
})
export class DeauthorizeSessionsComponent {
  deauthForm = this.formBuilder.group({
    verification: undefined as Verification | undefined,
  });
  invalidSecret: boolean = false;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private userVerificationService: UserVerificationService,
    private logService: LogService,
    private toastService: ToastService,
    private logoutService: LogoutService,
    private accountService: AccountService,
  ) {}

  submit = async () => {
    try {
      const verification: Verification = this.deauthForm.value.verification!;
      const request = await this.userVerificationService.buildRequest(verification);
      await this.apiService.postSecurityStamp(request);
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("sessionsDeauthorized"),
        message: this.i18nService.t("logBackIn"),
      });
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      await this.logoutService.logout(userId, "sessionsDeauthorized");
    } catch (e) {
      this.logService.error(e);
    }
  };

  static open(dialogService: DialogService) {
    return dialogService.open(DeauthorizeSessionsComponent);
  }
}
