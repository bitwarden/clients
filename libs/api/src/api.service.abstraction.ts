import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/sso-token.request";
import { UserApiTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/user-api-token.request";
import { WebAuthnLoginTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/webauthn-login-token.request";
import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";

export interface ApiServiceAbstraction {
  fetch(request: Request): Promise<Response>;
  nativeFetch(request: Request): Promise<Response>;
  send(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body: any,
    authed: boolean,
    hasResponse: boolean,
    apiUrl?: string | null,
    alterHeaders?: (headers: Headers) => void,
  ): Promise<any>;

  postIdentityToken(
    request:
      | UserApiTokenRequest
      | PasswordTokenRequest
      | SsoTokenRequest
      | WebAuthnLoginTokenRequest,
  ): Promise<
    IdentityTokenResponse | IdentityTwoFactorResponse | IdentityDeviceVerificationResponse
  >;
  refreshIdentityToken(): Promise<any>;
  getActiveBearerToken(): Promise<string>;
}
