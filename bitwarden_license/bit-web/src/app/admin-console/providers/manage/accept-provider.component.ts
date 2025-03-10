// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserAcceptRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-accept.request";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BaseAcceptComponent } from "@bitwarden/web-vault/app/common/base.accept.component";

@Component({
  selector: "app-accept-provider",
  templateUrl: "accept-provider.component.html",
})
export class AcceptProviderComponent extends BaseAcceptComponent {
  providerName: string;
  providerId: string;
  providerUserId: string;
  providerInviteToken: string;

  failedMessage = "providerInviteAcceptFailed";

  requiredParameters = ["providerId", "providerUserId", "token"];

  constructor(
    router: Router,
    i18nService: I18nService,
    route: ActivatedRoute,
    authService: AuthService,
    private apiService: ApiService,
    platformUtilService: PlatformUtilsService,
  ) {
    super(router, platformUtilService, i18nService, route, authService);
  }

  async authedHandler(qParams: Params) {
    const request = new ProviderUserAcceptRequest();
    request.token = qParams.token;

    await this.apiService.postProviderUserAccept(
      qParams.providerId,
      qParams.providerUserId,
      request,
    );

    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      this.i18nService.t("providerInviteAcceptedDesc"),
      { timeout: 10000 },
    );
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params) {
    this.providerName = qParams.providerName;
    this.providerId = qParams.providerId;
    this.providerUserId = qParams.providerUserId;
    this.providerInviteToken = qParams.token;
  }

  async register() {
    // We don't need users to complete email verification if they are coming directly from an emailed invite.
    // Therefore, we skip /signup and navigate directly to /finish-signup.
    await this.router.navigate(["/finish-signup"], {
      queryParams: {
        email: this.email,
        providerUserId: this.providerUserId,
        providerInviteToken: this.providerInviteToken,
      },
    });
  }
}
