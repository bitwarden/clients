// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

export interface PasswordPolicies {
  policies: Policy[];
  isPolicyAndAutoEnrollEnabled: boolean;
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
}

/** Translation key with optional placeholders, compatible with the Translation type from @bitwarden/components. */
export type LoginComponentTranslation = { key: string; placeholders?: string[] };

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
  /** When false, the page icon is hidden on the login page. */
  shouldShowPageIcons: boolean;

  /** The page title shown during email entry. */
  emailEntryPageTitle: string | LoginComponentTranslation;

  /** The page title shown during master password entry. */
  masterPasswordPageTitle: string | LoginComponentTranslation;

  /** The hint link text on the master password entry screen. */
  hintLinkText: string | LoginComponentTranslation;

  /** The submit button text on the master password entry screen. */
  masterPasswordSubmitButtonText: string | LoginComponentTranslation;

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
}
