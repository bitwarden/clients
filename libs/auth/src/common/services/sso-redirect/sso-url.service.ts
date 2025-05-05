import { ClientType } from "@bitwarden/common/enums";

export const DESKTOP_SSO_CALLBACK: string = "bitwarden://sso-callback";

export class SsoUrlService {
  /**
   * Builds a URL for redirecting users to the web app SSO component to complete SSO
   * @param webAppUrl The URL of the web app
   * @param clientType The client type that is initiating SSO, which will drive how the response is handled
   * @param redirectUri The redirect URI or callback that will receive the SSO code after authentication
   * @param state A state value that will be peristed through the SSO flow
   * @param codeChallenge A challenge value that will be used to verify the SSO code after authentication
   * @param email The optional email adddress of the user initiating SSO, which will be used to look up the org SSO identifier
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
    let url =
      webAppUrl +
      "/#/sso?clientId=" +
      clientType +
      "&redirectUri=" +
      encodeURIComponent(redirectUri) +
      "&state=" +
      state +
      "&codeChallenge=" +
      codeChallenge;

    if (email) {
      url += "&email=" + encodeURIComponent(email);
    }

    if (orgSsoIdentifier) {
      url += "&identifier=" + encodeURIComponent(orgSsoIdentifier);
    }

    return url;
  }
}
