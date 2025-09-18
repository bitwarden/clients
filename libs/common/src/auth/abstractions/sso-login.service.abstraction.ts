import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

export abstract class SsoLoginServiceAbstraction {
  /**
   * Gets the code verifier used for SSO.
   *
   * PKCE requires a `code_verifier` to be generated which is then used to derive a `code_challenge`.
   * While the `code_challenge` is verified upon return from the SSO provider, the `code_verifier` is
   * sent to the server with the `authorization_code` so that the server can derive the same `code_challenge`
   * and verify it matches the one sent in the request for the `authorization_code`.
   * @see https://datatracker.ietf.org/doc/html/rfc7636
   * @returns The code verifier used for SSO.
   */
  abstract getCodeVerifier: () => Promise<string | null>;
  /**
   * Sets the code verifier used for SSO.
   *
   * PKCE requires a `code_verifier` to be generated which is then used to derive a `code_challenge`.
   * While the `code_challenge` is verified upon return from the SSO provider, the `code_verifier` is
   * sent to the server with the `authorization_code` so that the server can derive the same `code_challenge`
   * and verify it matches the one sent in the request for the `authorization_code`.
   * @see https://datatracker.ietf.org/doc/html/rfc7636
   */
  abstract setCodeVerifier: (codeVerifier: string) => Promise<void>;
  /**
   * Gets the value of the SSO state.
   *
   * `state` is a parameter used in the Authorization Code Flow of OAuth 2.0 to prevent CSRF attacks. It is an
   * opaque value generated on the client and is sent to the authorization server. The authorization server
   * returns the `state` in the callback and the client verifies that the value returned matches the value sent.
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1
   * @returns The SSO state.
   */
  abstract getSsoState: () => Promise<string | null>;
  /**
   * Sets the value of the SSO state.
   *
   * `state` is a parameter used in the Authorization Code Flow of OAuth 2.0 to prevent CSRF attacks. It is an
   * opaque value generated on the client and is sent to the authorization server. The authorization server
   * returns the `state` in the callback and the client verifies that the value returned matches the value sent.
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1
   */
  abstract setSsoState: (ssoState: string) => Promise<void>;
  /**
   * Gets the value of the user's organization sso identifier.
   *
   * This should only be used during the SSO flow to identify the organization that the user is attempting to log in to.
   * Do not use this value outside of the SSO login flow.
   * @returns The user's organization identifier.
   */
  abstract getOrganizationSsoIdentifier: () => Promise<string | null>;
  /**
   * Sets the value of the user's organization sso identifier.
   *
   * This should only be used during the SSO flow to identify the organization that the user is attempting to log in to.
   * Do not use this value outside of the SSO login flow.
   */
  abstract setOrganizationSsoIdentifier: (organizationIdentifier: string) => Promise<void>;
  /**
   * Gets the user's email.
   * Note: This should only be used during the SSO flow to identify the user that is attempting to log in.
   * @returns The user's email.
   */
  abstract getSsoEmail: () => Promise<string | null>;
  /**
   * Sets the user's email.
   * Note: This should only be used during the SSO flow to identify the user that is attempting to log in.
   * @param email The user's email.
   * @returns A promise that resolves when the email has been set.
   *
   */
  abstract setSsoEmail: (email: string) => Promise<void>;
  /**
   * Clear the SSO email
   */
  abstract clearSsoEmail: () => Promise<void>;
  /**
   * Gets the value of the active user's organization sso identifier.
   *
   * This should only be used post successful SSO login once the user is initialized.
   * @param userId The user id for retrieving the org identifier state.
   */
  abstract getActiveUserOrganizationSsoIdentifier: (userId: UserId) => Promise<string | null>;
  /**
   * Sets the value of the active user's organization sso identifier.
   *
   * This should only be used post successful SSO login once the user is initialized.
   */
  abstract setActiveUserOrganizationSsoIdentifier: (
    organizationIdentifier: string,
    userId: UserId | undefined,
  ) => Promise<void>;

  /**
   * A cache list of user emails for whom the `PolicyType.RequireSso` policy is applied (that is, a list
   * of users who are required to authenticate via SSO only). The cache lives on the current device only.
   */
  abstract ssoRequiredCache$: Observable<Set<string> | null>;

  /**
   * Remove an email from the cached list of emails that must authenticate via SSO.
   */
  abstract removeFromSsoRequiredCacheIfPresent: (email: string) => Promise<void>;

  /**
   * Check if the user is required to authenticate via SSO. If so, add their email to a cache list.
   * We'll use this cache list to display ONLY the "Use single sign-on" button to the
   * user the next time they are on the /login page.
   *
   * If the user is not required to authenticate via SSO, remove their email from the cache list if it is present.
   */
  abstract updateSsoRequiredCache: (ssoLoginEmail: string, userId: UserId) => Promise<void>;
}
