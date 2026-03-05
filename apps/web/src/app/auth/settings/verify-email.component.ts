// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  BannerModule,
  ButtonModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-verify-email",
  templateUrl: "verify-email.component.html",
  imports: [AsyncActionsModule, BannerModule, ButtonModule, CommonModule, JslibModule, LinkModule],
})
export class VerifyEmailComponent {
  actionPromise: Promise<unknown>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onVerified = new EventEmitter<boolean>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onDismiss = new EventEmitter<void>();

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private tokenService: TokenService,
    private toastService: ToastService,
  ) {}

  async verifyEmail(): Promise<void> {
    await this.apiService.refreshIdentityToken();
    if (await this.tokenService.getEmailVerified()) {
      this.onVerified.emit(true);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("emailVerified"),
      });
      return;
    }

    await this.apiService.postAccountVerifyEmail();
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("checkInboxForVerification"),
    });
  }

  send = async () => {
    await this.verifyEmail();
  };
}
