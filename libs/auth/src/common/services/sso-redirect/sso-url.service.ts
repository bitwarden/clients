import { ClientType } from "@bitwarden/common/enums";

export const DESKTOP_SSO_CALLBACK: string = "bitwarden://sso-callback";

export class SsoUrlService {
  buildSsoUrl(
    baseUrl: string,
    clientType: ClientType,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    email: string,
  ): string {
    return (
      baseUrl +
      "/#/sso?clientId=" +
      clientType +
      "&redirectUri=" +
      encodeURIComponent(redirectUri) +
      "&state=" +
      state +
      "&codeChallenge=" +
      codeChallenge +
      "&email=" +
      encodeURIComponent(email)
    );
  }
}
