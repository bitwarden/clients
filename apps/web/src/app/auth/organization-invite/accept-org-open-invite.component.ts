import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AcceptFlowService } from "@bitwarden/angular/auth/accept-flow";
import { AccountWarning } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  OpenOrganizationInvite,
  OpenOrgInviteStatus,
  OpenOrgInviteUrlParams,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AnonLayoutWrapperDataService,
  IconModule,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "accept-org-open-invite.component.html",
  imports: [CommonModule, IconModule, SpinnerComponent, I18nPipe],
})
export class AcceptOrgOpenInviteComponent implements OnInit {
  protected loading = true;
  protected noSeats = false;
  protected linkNotFound = false;
  protected planNotSupported = false;

  private readonly failedMessage = "openInviteAcceptFailed";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly acceptFlowService: AcceptFlowService,
    private readonly organizationInviteService: OrganizationInviteService,
    private readonly anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private readonly accountService: AccountService,
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
  ) {}

  async ngOnInit() {
    // The open route puts `inviteLinkCode` in the path and `inviteKey` in the query
    // string. Pre-merge before handing to AcceptFlowService, which expects one Params bag.
    const [params, qParams] = await Promise.all([
      firstValueFrom(this.route.params),
      firstValueFrom(this.route.queryParams),
    ]);

    await this.acceptFlowService.run<OpenOrgInviteUrlParams>(
      { ...params, ...qParams },
      {
        failedMessage: this.failedMessage,
        parse: (p) =>
          p?.inviteLinkCode && p?.key
            ? { inviteLinkCode: p.inviteLinkCode, inviteKey: p.key }
            : null,
        authedHandler: (urlParams) => this.authedHandler(urlParams),
        unauthedHandler: (urlParams) => this.unauthedHandler(urlParams),
        // Scoped to the open key so a malformed open-invite URL doesn't wipe a
        // concurrent stashed direct invite.
        onError: () => this.organizationInviteService.clearOpenOrgInvite(),
      },
    );
    this.loading = false;
  }

  /**
   * Fetches the open-invite status and dispatches on the service's discriminated result:
   * pushes the matching anon-layout error state and returns null for classified
   * failures so the caller can short-circuit. `unexpected` re-throws into
   * `AcceptFlowService`'s generic error path.
   */
  private async fetchStatusOrShowError(code: string): Promise<OpenOrgInviteStatus | null> {
    const result = await this.organizationInviteService.getOpenOrgInviteStatus(code);
    switch (result.kind) {
      case "ok":
        return result.status;
      case "not-found":
        // TODO: placeholder — pending design. Icon (AccountWarning) and copy
        // (openInviteNotFoundTitle / openInviteNotFoundMessage in
        // apps/web/src/locales/en/messages.json) are stand-ins until design
        // provides the final asset + strings. Server response for 404 carries
        // no org name, so copy stays generic.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInviteNotFoundTitle" },
          pageIcon: AccountWarning,
        });
        this.linkNotFound = true;
        return null;
      case "plan-not-supported":
        // TODO: placeholder — pending design. Icon (AccountWarning) and copy
        // (openInvitePlanNotSupportedTitle / openInvitePlanNotSupportedMessage
        // in apps/web/src/locales/en/messages.json) are stand-ins until design
        // provides the final asset + strings. Server response for 400 carries
        // no org name, so copy stays generic.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInvitePlanNotSupportedTitle" },
          pageIcon: AccountWarning,
        });
        this.planNotSupported = true;
        return null;
      case "unexpected":
        throw new Error(result.errorMessage);
    }
  }

  private async unauthedHandler(urlParams: OpenOrgInviteUrlParams): Promise<void> {
    const status = await this.fetchStatusOrShowError(urlParams.inviteLinkCode);
    if (status == null) {
      return;
    }

    if (!status.seatsAvailable) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "openInviteNoSeatsTitle" },
        pageIcon: AccountWarning,
      });
      this.noSeats = true;
      return;
    }

    const invite = OpenOrganizationInvite.fromUrlParamsAndStatus(urlParams, status);
    await this.organizationInviteService.setOrganizationInvite(invite);

    // SSO-required orgs route straight to /sso. The deepLinkGuard() on this route
    // persisted the inbound URL on the initial unauth visit; once the user reaches
    // Unlocked post-SSO + JIT account setup (per Task 6 — pending product), the
    // guard replays /#/join/{code}?key={key} and authedHandler fires accept.
    if (invite.sso?.required) {
      await this.router.navigate(["/sso"], {
        queryParams: { identifier: invite.sso.orgSsoId },
      });
      return;
    }

    // Non-SSO unauthed: send to registration-start. We have no user identity in the URL,
    // so we can't auto-route to login vs. register — always start at register, and rely on
    // registration-start's existing "Already have an account?" link to route existing users.
    await this.router.navigate(["/signup"]);
  }

  private async authedHandler(urlParams: OpenOrgInviteUrlParams): Promise<void> {
    // Status is fetched here too (not just in unauthedHandler) because this handler
    // can be reached without going through unauthedHandler first — an authenticated
    // user pasting a `/join/<code>?key=<key>` URL directly into their session has no
    // stashed invite state to hydrate from. The fetch also gives us fresh error
    // surfaces (404 / 400 / no-seats) to render before committing an accept.
    const status = await this.fetchStatusOrShowError(urlParams.inviteLinkCode);
    if (status == null) {
      return;
    }

    if (!status.seatsAvailable) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "openInviteNoSeatsTitle" },
        pageIcon: AccountWarning,
      });
      this.noSeats = true;
      return;
    }

    const invite = OpenOrganizationInvite.fromUrlParamsAndStatus(urlParams, status);
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const success = await this.organizationInviteService.validateAndAcceptInvite(
      invite,
      activeUserId,
    );

    if (success) {
      this.toastService.showToast({
        message: this.i18nService.t("invitationAcceptedDesc"),
        variant: "success",
        timeout: 10000,
      });
      await this.router.navigate(["/"]);
    }
    // If !success, validateAndAcceptInvite already stashed the invite and logged out;
    // no further action needed here.
  }
}
