// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Params, Router } from "@angular/router";

import { LockIcon } from "@bitwarden/assets/svg";
import {
  DefaultLoginComponentService,
  HandleQueryParamErrorsResult,
  LoginComponentService,
  PasswordPolicies,
} from "@bitwarden/auth/angular";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import {
  OrgInviteKind,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";

import { RouterService } from "../../../../core/router.service";
import { SsoLoginFailedErrorKind } from "../../../sso/sso-login-failed-error-kind.type";

/**
 * Error codes emitted by the server's SSO callback as the `error` query
 * param when redirecting back to /login. Must stay in sync with
 * `Bit.Sso.Utilities.SsoRedirectUrlBuilder.ErrorCodes` on the server.
 */
const SsoRedirectErrorCode = Object.freeze({
  InviteAcceptanceRequired: "ssoOrgInviteAcceptanceRequired",
  OrgMembershipRequired: "ssoOrgMembershipRequired",
  StagedOrgUserInviteAcceptanceRequired: "ssoStagedOrgUserInviteAcceptanceRequired",
  // Future: AccessRevoked: "ssoOrganizationAccessRevoked", etc.
} as const);
type SsoRedirectErrorCode = (typeof SsoRedirectErrorCode)[keyof typeof SsoRedirectErrorCode];

const SsoLoginFailedRoute = "/sso-login-failed";

@Injectable()
export class WebLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  constructor(
    protected organizationInviteService: OrganizationInviteService,
    protected logService: LogService,
    protected policyService: InternalPolicyService,
    protected routerService: RouterService,
    cryptoFunctionService: CryptoFunctionService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    ssoLoginService: SsoLoginServiceAbstraction,
    private router: Router,
    private accountService: AccountService,
    private configService: ConfigService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {
    super(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
  }

  /**
   * For the web client, redirecting to the SSO component is done via the router.
   * We do not need to provide email, state, or code challenge since those are set in state
   * or generated on the SSO component.
   */
  protected override async redirectToSso(
    email: string,
    state: string,
    codeChallenge: string,
    orgSsoIdentifier?: string,
  ): Promise<void> {
    await this.router.navigate(["/sso"], {
      queryParams: { identifier: orgSsoIdentifier },
    });
    return;
  }

  async handleQueryParamErrors(params: Params): Promise<HandleQueryParamErrorsResult> {
    if (!params.organizationName || !params.organizationId || !params.email) {
      return { kind: "none" };
    }

    switch (params.error) {
      case SsoRedirectErrorCode.InviteAcceptanceRequired: {
        /**
         * Server tells us: the existing Bitwarden user has an unaccepted pending
         * direct-invite for this org and tried to SSO before accepting it. SSO is
         * refused until the invite is accepted.
         *
         * How a stashed invite is matched to this SSO redirect, by invite kind:
         *  - Direct: org id + email. Email defends against a stashed invite meant
         *    for a different SSO'd identity.
         *  - Open: org id only (open org invites carry no user identity). Rare here —
         *    would require both a stashed open org invite and a pending direct-invite
         *    row on the server for the same org.
         *
         * No match → warning toast. Covers: no invite stashed, a stashed invite
         * for a different org, or a stashed direct invite with an email mismatch.
         */
        if (await this.hasMatchingStashedOrgInvite(params)) {
          return this.autoProgressToMpEntry(params);
        }
        this.showInviteAcceptanceRequiredToast(params);
        return { kind: "none" };
      }

      case SsoRedirectErrorCode.OrgMembershipRequired: {
        /**
         * Server tells us: the existing Bitwarden user tried to SSO into an org
         * they have no membership record with — never directly invited, never
         * joined. The IdP authenticated them, but the server has no linkage to
         * complete SSO.
         *
         * How a stashed invite is matched to this SSO redirect, by invite kind:
         *  - Open (primary case): org id only. Existing user clicked an open
         *    invite for an org they've never joined.
         *  - Direct: org id + email. Defensive — a pending direct-invite row would
         *    normally trigger `InviteAcceptanceRequired` instead; direct+match
         *    lands here only if the row was revoked between click and SSO attempt.
         *
         * No match → warning toast. Covers: no invite stashed, or a stashed
         * invite for a different org.
         */
        if (await this.hasMatchingStashedOrgInvite(params)) {
          return this.autoProgressToMpEntry(params);
        }
        this.showInviteAcceptanceRequiredToast(params);
        return { kind: "none" };
      }

      case SsoRedirectErrorCode.StagedOrgUserInviteAcceptanceRequired: {
        /**
         * Server tells us: the existing Bitwarden user tried to SSO against a
         * Staged OrganizationUser row. The server promoted the row to Invited
         * and dispatched a direct-invite email; SSO is refused until an invite
         * is accepted.
         *
         * Only a stashed Open invite (matched on org id) can auto-progress here.
         * Staged status implies no Direct invite row exists yet, so no stashed
         * Direct can match. The server dispatches the direct invite regardless
         * because it has no signal the client already holds an open invite.
         *
         * No match → navigate to the terminal error page.
         */
        if (await this.hasMatchingStashedOrgInvite(params)) {
          return this.autoProgressToMpEntry(params);
        }
        await this.router.navigate([SsoLoginFailedRoute], {
          queryParams: {
            kind: SsoLoginFailedErrorKind.StagedOrgUserDirectInviteSent,
            organizationName: params.organizationName,
          },
        });
        return { kind: "redirected" };
      }

      default:
        return { kind: "none" };
    }
  }

  /**
   * Whether the stashed org invite matches the SSO redirect params:
   *  - Direct invite: org id + email (case-insensitive).
   *  - Open invite: org id only (open invites carry no user identity).
   */
  private async hasMatchingStashedOrgInvite(params: Params): Promise<boolean> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    const directMatch =
      orgInvite?.kind === OrgInviteKind.Direct &&
      orgInvite.organizationId === params.organizationId &&
      orgInvite.email?.toLowerCase() === params.email.toLowerCase();
    const openMatch =
      orgInvite?.kind === OrgInviteKind.Open && orgInvite.organizationId === params.organizationId;
    return directMatch || openMatch;
  }

  /**
   * Builds the auto-progress-to-MP-entry response for a matched stashed invite. The
   * user logs in with MP, then `deepLinkGuard` replays the invite's inbound URL
   * (`/accept-organization/...` or `/join/...`) and the corresponding component's
   * authedHandler fires the downstream accept. Same shape for both invite kinds.
   */
  private autoProgressToMpEntry(
    params: Params,
  ): Extract<HandleQueryParamErrorsResult, { kind: "auto-submit" }> {
    return {
      kind: "auto-submit",
      mpEntryLayoutOverride: {
        pageTitle: { key: "joinOrganizationName", placeholders: [params.organizationName] },
        pageSubtitle: { key: "acceptInviteWithMasterPassword" },
        pageIcon: LockIcon,
      },
    };
  }

  /**
   * Fires the shared "SSO for OrgX requires an invite" warning toast used by both
   * error-code branches when no stashed invite matches the redirect org.
   */
  private showInviteAcceptanceRequiredToast(params: Params): void {
    this.toastService.showToast({
      variant: "warning",
      title: null,
      message: this.i18nService.t("ssoLoginRequiresInviteAcceptance", params.organizationName),
      timeout: 10000,
    });
  }

  async getOrgPoliciesFromOrgInvite(email: string): Promise<PasswordPolicies | undefined> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();

    if (orgInvite == null) {
      return undefined;
    }

    if (orgInvite.kind === OrgInviteKind.Direct) {
      /**
       * Check if the email on the direct org invite matches the email submitted in the login form.
       * This is important because say userA at "userA@mail.com" clicks an emailed org invite link,
       * but then on the login page form they change the email to "userB@mail.com". We don't want to
       * apply the org invite in state to userB. Therefore we clear the login redirect url as well
       * as the org invite, allowing userB to login as normal.
       *
       * Open invites carry no user identity, so this check doesn't apply — the
       * AcceptOrgOpenInviteComponent and the pre-auth domain check in LoginComponent
       * handle the open-org-invite equivalents.
       */
      if (orgInvite.email !== email.toLowerCase()) {
        await this.routerService.getAndClearLoginRedirectUrl();
        await this.organizationInviteService.clearOrganizationInvite();

        this.logService.error(
          `WebLoginComponentService.getOrgPoliciesFromOrgInvite: Email mismatch. Expected: ${orgInvite.email}, Received: ${email}`,
        );
        return undefined;
      }
    } else {
      // Defense in depth: stale flag-on state may persist into a flag-off session.
      // Treat as no invite when disabled.
      // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — drop this
      // guard clause; the `else` branch can be removed entirely and the outer `if`
      // collapsed since the direct-invite branch above is the only remaining case.
      if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
        return undefined;
      }
    }

    const policies = await this.organizationInviteService.getOrgPoliciesForInvite(orgInvite);

    if (policies == null) {
      return undefined;
    }

    const resetPasswordPolicy = this.policyService.getResetPasswordPolicyOptions(
      policies,
      orgInvite.organizationId,
    );

    const isPolicyAndAutoEnrollEnabled =
      resetPasswordPolicy[1] && resetPasswordPolicy[0].autoEnrollEnabled;

    const enforcedPasswordPolicyOptions =
      this.policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

    return {
      policies,
      isPolicyAndAutoEnrollEnabled,
      enforcedPasswordPolicyOptions,
    };
  }
}
