import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { RegisterRouteService } from "@bitwarden/auth/common";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BaseAcceptComponent } from "../../common/base.accept.component";

import { AcceptOrganizationInviteService } from "./accept-organization.service";
import { OrganizationInvite } from "./organization-invite";

@Component({
  templateUrl: "accept-organization.component.html",
})
export class AcceptOrganizationComponent extends BaseAcceptComponent {
  orgName$ = this.acceptOrganizationInviteService.orgName$;
  protected requiredParameters: string[] = ["organizationId", "organizationUserId", "token"];

  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    route: ActivatedRoute,
    authService: AuthService,
    registerRouteService: RegisterRouteService,
    private acceptOrganizationInviteService: AcceptOrganizationInviteService,
  ) {
    super(router, platformUtilsService, i18nService, route, authService, registerRouteService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    const invite = OrganizationInvite.fromParams(qParams);
    const success = await this.acceptOrganizationInviteService.validateAndAcceptInvite(invite);

    if (!success) {
      return;
    }

    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      invite.initOrganization
        ? this.i18nService.t("inviteInitAcceptedDesc")
        : this.i18nService.t("inviteAcceptedDesc"),
      { timeout: 10000 },
    );

    await this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    const invite = OrganizationInvite.fromParams(qParams);
    await this.acceptOrganizationInviteService.setOrganizationInvitation(invite);
    await this.accelerateInviteAcceptIfPossible(invite);
  }

  /**
   * In certain scenarios, we want to accelerate the user through the accept org invite process
   * For example, if the user has a BW account already, we want them to be taken to login instead of creation.
   */
  private async accelerateInviteAcceptIfPossible(invite: OrganizationInvite): Promise<void> {
    // if orgUserHasExistingUser is null, we can't determine the user's status
    // so we don't want to accelerate the process
    if (invite.orgUserHasExistingUser == null) {
      return;
    }

    // if user exists, send user to login
    if (invite.orgUserHasExistingUser) {
      await this.router.navigate(["/login"], {
        queryParams: { email: invite.email },
      });
      return;
    }

    if (invite.orgSsoIdentifier) {
      // We only send sso org identifier if the org has SSO enabled and the SSO policy required.
      // Will JIT provision the user.
      // Note: If the organization has Admin Recovery enabled, the user will be accepted into the org
      // upon enrollment. The user should not be returned here.
      await this.router.navigate(["/sso"], {
        queryParams: { email: invite.email, identifier: invite.orgSsoIdentifier },
      });
      return;
    }

    // if SSO is disabled OR if sso is enabled but the SSO login required policy is not enabled
    // then send user to create account

    // TODO: update logic when email verification flag is removed
    let queryParams: Params;
    let registerRoute = await firstValueFrom(this.registerRoute$);
    if (registerRoute === "/register") {
      queryParams = {
        fromOrgInvite: "true",
        email: invite.email,
      };
    } else if (registerRoute === "/signup") {
      // We have to override the base component route b/c it is correct for other components
      // that extend the base accept comp. We don't need users to complete email verification
      // if they are coming directly from an emailed org invite.
      registerRoute = "/finish-signup";
      queryParams = {
        email: invite.email,
      };
    }

    await this.router.navigate([registerRoute], {
      queryParams: queryParams,
    });
    return;
  }
}
