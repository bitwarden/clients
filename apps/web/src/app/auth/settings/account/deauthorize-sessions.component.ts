// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-deauthorize-sessions",
  templateUrl: "deauthorize-sessions.component.html",
})
export class DeauthorizeSessionsComponent {
  masterPassword: Verification;
  formPromise: Promise<unknown>;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private userVerificationService: UserVerificationService,
    private messagingService: MessagingService,
    private logService: LogService,
    private toastService: ToastService,
  ) {}

  async submit() {
    try {
      this.formPromise = this.userVerificationService
        .buildRequest(this.masterPassword)
        .then((request) => this.apiService.postSecurityStamp(request));
      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("sessionsDeauthorized"),
        message: this.i18nService.t("logBackIn"),
      });
      this.messagingService.send("logout");
    } catch (e) {
      this.logService.error(e);
    }
  }
}
