// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PasswordHintRequest } from "@bitwarden/common/auth/models/request/password-hint.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Directive()
export class HintComponent implements OnInit {
  email = "";
  formPromise: Promise<any>;

  protected successRoute = "login";
  protected onSuccessfulSubmit: () => void;

  constructor(
    protected router: Router,
    protected i18nService: I18nService,
    protected apiService: ApiService,
    protected platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private loginEmailService: LoginEmailServiceAbstraction,
    protected toastService: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.email = (await firstValueFrom(this.loginEmailService.loginEmail$)) ?? "";
  }

  async submit() {
    if (this.email == null || this.email === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("emailRequired"),
      });
      return;
    }
    if (this.email.indexOf("@") === -1) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidEmail"),
      });
      return;
    }

    try {
      this.formPromise = this.apiService.postPasswordHint(new PasswordHintRequest(this.email));
      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("masterPassSent"),
      });
      if (this.onSuccessfulSubmit != null) {
        this.onSuccessfulSubmit();
      } else if (this.router != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate([this.successRoute]);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }
}
