// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BaseAcceptComponent } from "../../../common/base.accept.component";
import { SharedModule } from "../../../shared";
import { EmergencyAccessModule } from "../emergency-access.module";
import { EmergencyAccessService } from "../services/emergency-access.service";

@Component({
  standalone: true,
  imports: [SharedModule, EmergencyAccessModule],
  templateUrl: "accept-emergency.component.html",
})
export class AcceptEmergencyComponent extends BaseAcceptComponent {
  name: string;
  emergencyAccessId: string;
  acceptEmergencyAccessInviteToken: string;

  protected requiredParameters: string[] = ["id", "name", "email", "token"];
  protected failedShortMessage = "emergencyInviteAcceptFailedShort";
  protected failedMessage = "emergencyInviteAcceptFailed";

  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    route: ActivatedRoute,
    authService: AuthService,
    private emergencyAccessService: EmergencyAccessService,
  ) {
    super(router, platformUtilsService, i18nService, route, authService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    this.actionPromise = this.emergencyAccessService.accept(qParams.id, qParams.token);
    await this.actionPromise;
    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      this.i18nService.t("emergencyInviteAcceptedDesc"),
      { timeout: 10000 },
    );
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    this.name = qParams.name;
    if (this.name != null) {
      // Fix URL encoding of space issue with Angular
      this.name = this.name.replace(/\+/g, " ");
    }

    if (qParams.id) {
      this.emergencyAccessId = qParams.id;
    }

    if (qParams.token) {
      this.acceptEmergencyAccessInviteToken = qParams.token;
    }
  }

  async register() {
    // We don't need users to complete email verification if they are coming directly from an emailed invite.
    // Therefore, we skip /signup and navigate directly to /finish-signup.
    await this.router.navigate(["/finish-signup"], {
      queryParams: {
        email: this.email,
        acceptEmergencyAccessInviteToken: this.acceptEmergencyAccessInviteToken,
        emergencyAccessId: this.emergencyAccessId,
      },
    });
  }
}
