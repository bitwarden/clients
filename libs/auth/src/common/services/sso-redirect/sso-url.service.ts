import { ClientType } from "@bitwarden/common/enums";

export const DESKTOP_SSO_CALLBACK: string = "bitwarden://sso-callback";

export class SsoUrlService {
  /**
   * Builds a URL for redirecting users to the web app SSO component to complete SSO
   * @param webAppUrl The URL of the web app
   * @param clientType The client type that is initiating SSO, which will drive how the response is handled
   * @param redirectUri The redirect URI or callback that will receive the SSO code after authentication
   * @param state A state value that will be persisted through the SSO flow
   * @param codeChallenge A challenge value that will be used to verify the SSO code after authentication
   * @param email The optional email address of the user initiating SSO, which will be used to look up the org SSO identifier
   * @param orgSsoIdentifier The optional SSO identifier of the org that is initiating SSO
   * @returns The URL for redirecting users to the web app SSO component
   */
  buildSsoUrl(
    webAppUrl: string,
    clientType: ClientType,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    email?: string,
    orgSsoIdentifier?: string,
  ): string {
    return (
      webAppUrl +
      "/#/sso?" +
      this.buildSsoQueryParams(
        clientType,
        redirectUri,
        state,
        codeChallenge,
        email,
        orgSsoIdentifier,
      )
    );
  }

  /**
   * Builds a URL that starts SSO via the web app's `sso-launch-connector.html` page rather than
   * navigating the browser directly to the `/#/sso` hash route.
   *
   * The connector is a real path + query page, so the launch URL survives the sign-in roundtrip of
   * a pre-authenticating reverse proxy, which can neither observe nor restore a URL fragment. Use
   * this variant for native clients (e.g. desktop) launching the system browser against a server
   * that sits behind such a proxy. For every other case {@link buildSsoUrl} is sufficient.
   *
   * The parameters are identical to {@link buildSsoUrl}; the connector forwards them verbatim to the
   * SSO hash route once the proxy challenge has been satisfied.
   */
  buildSsoLaunchConnectorUrl(
    webAppUrl: string,
    clientType: ClientType,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    email?: string,
    orgSsoIdentifier?: string,
  ): string {
    return (
      webAppUrl +
      "/sso-launch-connector.html?" +
      this.buildSsoQueryParams(
        clientType,
        redirectUri,
        state,
        codeChallenge,
        email,
        orgSsoIdentifier,
      )
    );
  }

  private buildSsoQueryParams(
    clientType: ClientType,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    email?: string,
    orgSsoIdentifier?: string,
  ): string {
    let params =
      "clientId=" +
      clientType +
      "&redirectUri=" +
      encodeURIComponent(redirectUri) +
      "&state=" +
      state +
      "&codeChallenge=" +
      codeChallenge;

    if (email) {
      params += "&email=" + encodeURIComponent(email);
    }

    if (orgSsoIdentifier) {
      params += "&identifier=" + encodeURIComponent(orgSsoIdentifier);
    }

    return params;
  }
}
