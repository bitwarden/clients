import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AcceptFlowService } from "@bitwarden/angular/auth/accept-flow";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "accept-org-direct-invite.component.html",
  imports: [IconModule, I18nPipe],
})
export class AcceptOrgDirectInviteComponent implements OnInit {
  loading = true;

  private readonly failedMessage = "inviteAcceptFailed";

  constructor(
    private router: Router,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private acceptFlowService: AcceptFlowService,
    private organizationInviteService: OrganizationInviteService,
    private accountService: AccountService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.queryParams);
    await this.acceptFlowService.run<OrganizationInvite>(qParams, {
      failedMessage: this.failedMessage,
      parse: (p) => OrganizationInvite.fromUrlParams(p ?? {}),
      authedHandler: (invite) => this.authedHandler(invite),
      unauthedHandler: (invite) => this.unauthedHandler(invite),
      getErrorMessage: (apiError) => this.getErrorMessage(apiError),
      // Clear the stashed invite when accept throws. All server-side accept rejections
      // (expired/revoked/already-accepted/policy violations) are permanent, so retaining
      // the stash would let its policies bleed into the voluntary change-password component.
      onError: () => this.organizationInviteService.clearOrganizationInvite(),
    });
    this.loading = false;
  }

  private async authedHandler(invite: OrganizationInvite): Promise<void> {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const success = await this.organizationInviteService.validateAndAcceptInvite(
      invite,
      activeUserId,
    );

    if (!success) {
      return;
    }

    this.toastService.showToast({
      message: invite.initOrganization
        ? this.i18nService.t("inviteInitAcceptedDesc")
        : this.i18nService.t("invitationAcceptedDesc"),
      variant: "success",
      timeout: 10000,
    });

    await this.router.navigate(["/"]);
  }

  private async unauthedHandler(invite: OrganizationInvite): Promise<void> {
    await this.organizationInviteService.setOrganizationInvite(invite);
    await this.navigateInviteAcceptance(invite);
  }

  private getErrorMessage(errorMessage: string | null): string {
    // Handle expired token specifically for org invites by returning the generic
    // failed message rather than the raw API error.
    if (errorMessage === "Expired token.") {
      return this.i18nService.t(this.failedMessage);
    }

    // TODO PM-39080: Translate the description fragment via i18nService.
    // Today the server returns raw English strings (e.g. "Your organization access has been
    // revoked.", "Invalid token.", "Already accepted.") that get interpolated verbatim into
    // `inviteAcceptFailedShort` ("Unable to accept invitation. $DESCRIPTION$"), so non-English
    // users see English fragments and our UX leaks server-API wording.
    //
    // Plan: keep the `inviteAcceptFailedShort` wrapper (it is already localized) and add a
    // server-string -> i18n-key map for the description fragment. Each mapped key is just the
    // reason ("Your organization access has been revoked."), and we interpolate the translated
    // fragment back into `inviteAcceptFailedShort` so every locale still gets
    // "{localized prefix} {localized reason}". The authoritative catalog of server strings
    // lives in the server repo at
    // `src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AcceptOrgUserCommand.cs`
    // plus the token errors in `OrgUserInviteTokenable` / `TokenableValidationError`. Fall
    // through to the current raw-passthrough interpolation for unmapped strings so we never
    // drop information when the server adds a new error. The expired-token special case above
    // collapses into the map once it has a mapped key. Same treatment will benefit the other
    // 5 `BaseAcceptComponent` subclasses.
    return errorMessage != null
      ? this.i18nService.t("inviteAcceptFailedShort", errorMessage)
      : this.i18nService.t(this.failedMessage);
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
}
