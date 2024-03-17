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
  getCodeVerifier: () => Promise<string>;
  /**
   * Sets the code verifier used for SSO.
   *
   * PKCE requires a `code_verifier` to be generated which is then used to derive a `code_challenge`.
   * While the `code_challenge` is verified upon return from the SSO provider, the `code_verifier` is
   * sent to the server with the `authorization_code` so that the server can derive the same `code_challenge`
   * and verify it matches the one sent in the request for the `authorization_code`.
   * @see https://datatracker.ietf.org/doc/html/rfc7636
   */
  setCodeVerifier: (codeVerifier: string) => Promise<void>;
  /**
   * Gets the value of the SSO state.
   *
   * `state` is a parameter used in the Authorization Code Flow of OAuth 2.0 to prevent CSRF attacks. It is an
   * opaque value generated on the client and is sent to the authorization server. The authorization server
   * returns the `state` in the callback and the client verifies that the value returned matches the value sent.
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1
   * @returns The SSO state.
   */
  getSsoState: () => Promise<string>;
  /**
   * Sets the value of the SSO state.
   *
   * `state` is a parameter used in the Authorization Code Flow of OAuth 2.0 to prevent CSRF attacks. It is an
   * opaque value generated on the client and is sent to the authorization server. The authorization server
   * returns the `state` in the callback and the client verifies that the value returned matches the value sent.
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1
   */
  setSsoState: (ssoState: string) => Promise<void>;
  /**
   * Gets the value of the user's organization sso identifier.
   *
   * This should only be used during the SSO flow to identify the organization that the user is attempting to log in to.
   * Do not use this value outside of the SSO login flow.
   * @returns The user's organization identifier.
   */
  getOrganizationSsoIdentifier: () => Promise<string>;
  /**
   * Sets the value of the user's organization sso identifier.
   *
   * This should only be used during the SSO flow to identify the organization that the user is attempting to log in to.
   * Do not use this value outside of the SSO login flow.
   */
  setOrganizationSsoIdentifier: (organizationIdentifier: string) => Promise<void>;
  /**
   * Gets the user's email.
   * Note: This should only be used during the SSO flow to identify the user that is attempting to log in.
   * @returns The user's email.
   */
  getSsoEmail: () => Promise<string>;
  /**
   * Sets the user's email.
   * Note: This should only be used during the SSO flow to identify the user that is attempting to log in.
   * @param email The user's email.
   * @returns A promise that resolves when the email has been set.
   *
   */
  setSsoEmail: (email: string) => Promise<void>;
  /**
   * Gets the value of the active user's organization sso identifier.
   *
   * This should only be used post successful SSO login once the user is initialized.
   */
  getActiveUserOrganizationSsoIdentifier: () => Promise<string>;
  /**
   * Sets the value of the active user's organization sso identifier.
   *
   * This should only be used post successful SSO login once the user is initialized.
   */
  setActiveUserOrganizationSsoIdentifier: (organizationIdentifier: string) => Promise<void>;
}
