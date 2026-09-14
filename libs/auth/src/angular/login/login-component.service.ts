// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Params } from "@angular/router";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

import { HandleQueryParamErrorsResult } from "./handle-query-param-errors-result.type";

export interface PasswordPolicies {
  policies: Policy[];
  isPolicyAndAutoEnrollEnabled: boolean;
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
}

/**
 * The `LoginComponentService` allows the single libs/auth `LoginComponent` to
 * delegate all client-specific functionality to client-specific service
 * implementations of `LoginComponentService`.
 *
 * The `LoginComponentService` should not be confused with the
 * `LoginStrategyService`, which is used to determine the login strategy and
 * performs the core login logic.
 */
export abstract class LoginComponentService {
  /**
   * Gets the organization policies if there is an organization invite.
   * - Used by: Web
   */
  getOrgPoliciesFromOrgInvite?: (email: string) => Promise<PasswordPolicies | null>;

  /**
   * Indicates whether login with passkey is supported on the given client
   */
  isLoginWithPasskeySupported: () => boolean;

  /**
   * Redirects the user to the SSO login page, either via route or in a new browser window.
   */
  redirectToSsoLogin: (email: string) => Promise<void | null>;

  /**
   * Redirects the user to the SSO login page with organization SSO identifier, either via route or in a new browser window.
   */
  redirectToSsoLoginWithOrganizationSsoIdentifier: (
    email: string,
    orgSsoIdentifier: string | null | undefined,
  ) => Promise<void | null>;

  /**
   * Shows the back button.
   */
  showBackButton: (showBackButton: boolean) => void;

  /**
   * Handles error responses surfaced via /login query params (today:
   * server-side SSO redirects carrying `error` + `organizationName`). Returns
   * a discriminated result so the caller can distinguish auto-progress
   * (`auto-submit`), a handler-initiated redirect away from /login
   * (`redirected`), and no-op outcomes (`none`).
   * - Used by: Web
   */
  handleQueryParamErrors?: (params: Params) => Promise<HandleQueryParamErrorsResult>;
}
