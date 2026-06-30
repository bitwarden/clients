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
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
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
        const orgInvite = await this.organizationInviteService.getOrganizationInvite();
        // Match on organizationId (stable) AND email (defensive). Org display names can
        // drift between when an invite is sent and when SSO is attempted; the id is the
        // source of truth for "this stashed invite is for the org the server just rejected."
        const stashMatches =
          orgInvite?.organizationId === params.organizationId &&
          orgInvite?.email?.toLowerCase() === params.email.toLowerCase();

        if (stashMatches) {
          // Case A: matching stashed invite — auto-progress to MP entry and supply the
          // override that LoginComponent threads into toggleLoginUiState.
          return {
            autoSubmit: true,
            mpEntryLayoutOverride: {
              pageTitle: { key: "joinOrganizationName", placeholders: [params.organizationName] },
              pageSubtitle: { key: "acceptInviteWithMasterPassword" },
              pageIcon: LockIcon,
            },
          };
        }

        // Case B: no matching stash — the redirect-back UI's invite-acceptance claim
        // does not apply to this session, so warn the user and stay at email entry.
        this.toastService.showToast({
          variant: "warning",
          title: null,
          message: this.i18nService.t("ssoLoginRequiresInviteAcceptance", params.organizationName),
          timeout: 10000,
        });
        return { autoSubmit: false };
      }
      default:
        return { autoSubmit: false };
    }
  }

  async getOrgPoliciesFromOrgInvite(email: string): Promise<PasswordPolicies | undefined> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();

    if (orgInvite == null) {
      return undefined;
    }

    /**
     * Check if the email on the org invite matches the email submitted in the login form. This is
     * important because say userA at "userA@mail.com" clicks an emailed org invite link, but then
     * on the login page form they change the email to "userB@mail.com". We don't want to apply the org
     * invite in state to userB. Therefore we clear the login redirect url as well as the org invite,
     * allowing userB to login as normal.
     */
    if (orgInvite.email !== email.toLowerCase()) {
      await this.routerService.getAndClearLoginRedirectUrl();
      await this.organizationInviteService.clearOrganizationInvite();

      this.logService.error(
        `WebLoginComponentService.getOrgPoliciesFromOrgInvite: Email mismatch. Expected: ${orgInvite.email}, Received: ${email}`,
      );
      return undefined;
    }

    const policies = await this.organizationInviteService.getInvitePolicies(orgInvite);

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
