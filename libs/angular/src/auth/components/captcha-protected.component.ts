// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, Input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CaptchaIFrame } from "@bitwarden/common/auth/captcha-iframe";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";

@Directive()
export abstract class CaptchaProtectedComponent {
  @Input() captchaSiteKey: string = null;
  captchaToken: string = null;
  captcha: CaptchaIFrame;

  constructor(
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected toastService: ToastService,
  ) {}

  async setupCaptcha() {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    this.captcha = new CaptchaIFrame(
      window,
      webVaultUrl,
      this.i18nService,
      (token: string) => {
        this.captchaToken = token;
      },
      (error: string) => {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: error,
        });
      },
      (info: string) => {
        this.toastService.showToast({
          variant: "info",
          title: this.i18nService.t("info"),
          message: info,
        });
      },
    );
  }

  showCaptcha() {
    return !Utils.isNullOrWhitespace(this.captchaSiteKey);
  }

  protected handleCaptchaRequired(response: { captchaSiteKey: string }): boolean {
    if (Utils.isNullOrWhitespace(response.captchaSiteKey)) {
      return false;
    }

    this.captchaSiteKey = response.captchaSiteKey;
    this.captcha.init(response.captchaSiteKey);
    return true;
  }
}
