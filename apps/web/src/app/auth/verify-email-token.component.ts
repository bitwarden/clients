// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { VerifyEmailRequest } from "@bitwarden/common/models/request/verify-email.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-verify-email-token",
  templateUrl: "verify-email-token.component.html",
  standalone: false,
})
export class VerifyEmailTokenComponent implements OnInit {
  constructor(
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private logService: LogService,
    private tokenService: TokenService,
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.userId != null && qParams.token != null) {
        try {
          await this.apiService.postAccountVerifyEmailToken(
            new VerifyEmailRequest(qParams.userId, qParams.token),
          );
          if (await firstValueFrom(this.tokenService.hasAccessToken$(qParams.userId))) {
            await this.apiService.refreshIdentityToken();
          }
          this.toastService.showToast({
            variant: "success",
            title: null,
            message: this.i18nService.t("emailVerified"),
          });
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate(["/"]);
          return;
        } catch (e) {
          this.logService.error(e);
        }
      }
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("emailVerifiedFailed"),
      });
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/"]);
    });
  }
}
