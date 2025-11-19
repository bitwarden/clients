// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

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
   * Redirects the user to the SSO login page, either via route or in a new browser window.
   */
  redirectToSsoLogin: (email: string) => Promise<void | null>;

  /**
   * Shows the back button.
   */
  showBackButton: (showBackButton: boolean) => void;
}
