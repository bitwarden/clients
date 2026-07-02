// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Params, Router } from "@angular/router";

import { LockIcon } from "@bitwarden/assets/svg";
import {
  DefaultLoginComponentService,
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
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AnonLayoutWrapperData, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { RouterService } from "../../../../core/router.service";

/**
 * Error codes emitted by the server's SSO callback as the `error` query
 * param when redirecting back to /login. Must stay in sync with
 * `Bit.Sso.Utilities.SsoRedirectUrlBuilder.ErrorCodes` on the server.
 */
const SsoRedirectErrorCode = Object.freeze({
  InviteAcceptanceRequired: "ssoOrgInviteAcceptanceRequired",
  OrgMembershipRequired: "ssoOrgMembershipRequired",
  // Future: AccessRevoked: "ssoOrganizationAccessRevoked", etc.
} as const);
type SsoRedirectErrorCode = (typeof SsoRedirectErrorCode)[keyof typeof SsoRedirectErrorCode];

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

  async handleQueryParamErrors(
    params: Params,
  ): Promise<{ autoSubmit: boolean; mpEntryLayoutOverride?: Partial<AnonLayoutWrapperData> }> {
    if (!params.organizationName || !params.organizationId || !params.email) {
      return { autoSubmit: false };
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
         *  - Open: org id only (open invites carry no user identity). Rare here —
         *    would require both a stashed open invite and a pending direct-invite
         *    row on the server for the same org.
         *
         * No match → warning toast. Covers: no invite stashed, a stashed invite
         * for a different org, or a stashed direct invite with an email mismatch.
         */
        const orgInvite = await this.organizationInviteService.getOrganizationInvite();
        const directMatch =
          orgInvite?.kind === OrgInviteKind.Direct &&
          orgInvite.organizationId === params.organizationId &&
          orgInvite.email?.toLowerCase() === params.email.toLowerCase();
        const openMatch =
          orgInvite?.kind === OrgInviteKind.Open &&
          orgInvite.organizationId === params.organizationId;

        if (directMatch || openMatch) {
          return this.autoProgressToMpEntry(params);
        }
        this.showInviteAcceptanceRequiredToast(params);
        return { autoSubmit: false };
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
        const orgInvite = await this.organizationInviteService.getOrganizationInvite();
        const directMatch =
          orgInvite?.kind === OrgInviteKind.Direct &&
          orgInvite.organizationId === params.organizationId &&
          orgInvite.email?.toLowerCase() === params.email.toLowerCase();
        const openMatch =
          orgInvite?.kind === OrgInviteKind.Open &&
          orgInvite.organizationId === params.organizationId;

        if (directMatch || openMatch) {
          return this.autoProgressToMpEntry(params);
        }
        this.showInviteAcceptanceRequiredToast(params);
        return { autoSubmit: false };
      }

      default:
        return { autoSubmit: false };
    }
  }

  /**
   * Builds the auto-progress-to-MP-entry response for a matched stashed invite. The
   * user logs in with MP, then `deepLinkGuard` replays the invite's inbound URL
   * (`/accept-organization/...` or `/join/...`) and the corresponding component's
   * authedHandler fires the downstream accept. Same shape for both invite kinds.
   */
  private autoProgressToMpEntry(params: Params): {
    autoSubmit: true;
    mpEntryLayoutOverride: Partial<AnonLayoutWrapperData>;
  } {
    return {
      autoSubmit: true,
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
       * handle the open-invite equivalents.
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
      // Defense in depth: even though the open-invite landing route is gated by
      // `FeatureFlag.GenerateInviteLink`, stale state from a prior flag-on session
      // could persist into a flag-off session. Treat as no invite when disabled.
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
