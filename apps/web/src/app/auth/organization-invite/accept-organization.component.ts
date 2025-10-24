// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { BaseAcceptComponent } from "../../common/base.accept.component";

import { AcceptOrganizationInviteService } from "./accept-organization.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "accept-organization.component.html",
  standalone: false,
})
export class AcceptOrganizationComponent extends BaseAcceptComponent {
  orgName$ = this.acceptOrganizationInviteService.orgName$;
  protected requiredParameters: string[] = ["organizationId", "organizationUserId", "token"];

  constructor(
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    private acceptOrganizationInviteService: AcceptOrganizationInviteService,
    private organizationInviteService: OrganizationInviteService,
    private accountService: AccountService,
    private toasService: ToastService,
  ) {
    super(router, platformUtilsService, i18nService, route, authService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    const invite = this.fromParams(qParams);
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const success = await this.acceptOrganizationInviteService.validateAndAcceptInvite(
      invite,
      activeUserId,
    );

    if (!success) {
      return;
    }

    this.toasService.showToast({
      message: invite.initOrganization
        ? this.i18nService.t("inviteInitAcceptedDesc")
        : this.i18nService.t("invitationAcceptedDesc"),
      variant: "success",
      timeout: 10000,
    });

    await this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    const invite = this.fromParams(qParams);

    await this.organizationInviteService.setOrganizationInvitation(invite);
    await this.navigateInviteAcceptance(invite);
  }

  /**
   * In certain scenarios, we want to accelerate the user through the accept org invite process
   * For example, if the user has a BW account already, we want them to be taken to login instead of creation.
   */
  private async navigateInviteAcceptance(invite: OrganizationInvite): Promise<void> {
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

    // We don't need users to complete email verification if they are coming directly from an emailed invite.
    // Therefore, we skip /signup and navigate directly to /finish-signup.
    await this.router.navigate(["/finish-signup"], {
      queryParams: {
        email: invite.email,
      },
    });
    return;
  }

  private fromParams(params: Params): OrganizationInvite | null {
    if (params == null) {
      return null;
    }

    return Object.assign(new OrganizationInvite(), {
      email: params.email,
      initOrganization: params.initOrganization?.toLocaleLowerCase() === "true",
      orgSsoIdentifier: params.orgSsoIdentifier,
      orgUserHasExistingUser: params.orgUserHasExistingUser?.toLocaleLowerCase() === "true",
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      organizationUserId: params.organizationUserId,
      token: params.token,
    });
  }
}
