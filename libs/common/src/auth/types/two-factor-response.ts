import { TwoFactorAuthenticatorResponse } from "../two-factor/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../two-factor/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../two-factor/response/two-factor-email.response";
import { TwoFactorOrganizationDuoResponse } from "../two-factor/response/two-factor-organization-duo.response";
import { TwoFactorRecoverResponse } from "../two-factor/response/two-factor-recover.response";
import { TwoFactorWebAuthnResponse } from "../two-factor/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../two-factor/response/two-factor-yubi-key.response";

export type TwoFactorResponse =
  | TwoFactorRecoverResponse
  | TwoFactorDuoResponse
  | TwoFactorOrganizationDuoResponse
  | TwoFactorEmailResponse
  | TwoFactorWebAuthnResponse
  | TwoFactorAuthenticatorResponse
  | TwoFactorYubiKeyResponse;
