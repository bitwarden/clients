// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, NgZone } from "@angular/core";
import { UntypedFormControl, UntypedFormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-accessibility-cookie",
  templateUrl: "accessibility-cookie.component.html",
})
export class AccessibilityCookieComponent {
  listenForCookie = false;
  hCaptchaWindow: Window;

  accessibilityForm = new UntypedFormGroup({
    link: new UntypedFormControl("", Validators.required),
  });

  constructor(
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected ngZone: NgZone,
    private toastService: ToastService,
  ) {}

  registerhCaptcha() {
    this.platformUtilsService.launchUri("https://www.hcaptcha.com/accessibility");
  }

  async close() {
    const [cookie] = await ipc.auth.getHcaptchaAccessibilityCookie();
    if (cookie) {
      this.onCookieSavedSuccess();
    } else {
      this.onCookieSavedFailure();
    }
    await this.router.navigate(["/login"]);
  }

  onCookieSavedSuccess() {
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("accessibilityCookieSaved"),
    });
  }

  onCookieSavedFailure() {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t("noAccessibilityCookieSaved"),
    });
  }

  async submit() {
    if (Utils.getHostname(this.accessibilityForm.value.link) !== "accounts.hcaptcha.com") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidUrl"),
      });
      return;
    }
    this.listenForCookie = true;
    window.open(this.accessibilityForm.value.link, "_blank", "noopener noreferrer");
  }
}
