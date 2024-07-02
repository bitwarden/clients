import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { RegisterRouteService } from "@bitwarden/auth/common";
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

  protected requiredParameters: string[] = ["id", "name", "email", "token"];
  protected failedShortMessage = "emergencyInviteAcceptFailedShort";
  protected failedMessage = "emergencyInviteAcceptFailed";

  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    route: ActivatedRoute,
    authService: AuthService,
    registerRouteService: RegisterRouteService,
    private emergencyAccessService: EmergencyAccessService,
  ) {
    super(router, platformUtilsService, i18nService, route, authService, registerRouteService);
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
  }
}
