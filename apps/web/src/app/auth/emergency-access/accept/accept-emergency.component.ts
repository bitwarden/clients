// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { isId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { BaseAcceptComponent } from "../../../common/base.accept.component";
import { SharedModule } from "../../../shared";
import { EmergencyAccessModule } from "../emergency-access.module";
import { EmergencyAccessService } from "../services/emergency-access.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
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
    private toastService: ToastService,
  ) {
    super(router, platformUtilsService, i18nService, route, authService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    const qParamsValidated = this.validateIdParam(qParams);
    if (!qParamsValidated) {
      await this.handleInvalidInvite();
      return;
    }

    this.actionPromise = this.emergencyAccessService.accept(qParams.id, qParams.token);
    await this.actionPromise;
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("inviteAccepted"),
      message: this.i18nService.t("emergencyInviteAcceptedDesc"),
      timeout: 10000,
    });
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    const idParamValidated = this.validateIdParam(qParams);
    if (!idParamValidated) {
      await this.handleInvalidInvite();
      return;
    }

    this.name = qParams.name;
    if (this.name != null) {
      // Fix URL encoding of space issue with Angular
      this.name = this.name.replace(/\+/g, " ");
    }
    this.emergencyAccessId = qParams.id;
    this.acceptEmergencyAccessInviteToken = qParams.token;
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

  private validateIdParam(qParams: Params): boolean {
    return isId(qParams.id);
  }

  private async handleInvalidInvite(): Promise<void> {
    this.toastService.showToast({
      message: this.i18nService.t(this.failedMessage),
      variant: "error",
      timeout: 10000,
    });
    await this.router.navigate(["/"]);
    return;
  }
}
