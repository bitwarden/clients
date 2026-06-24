import { TwoFactorAuthenticatorResponse } from "../response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../response/two-factor-email.response";
import { TwoFactorOrganizationDuoResponse } from "../response/two-factor-organization-duo.response";
import { TwoFactorRecoverResponse } from "../response/two-factor-recover.response";
import { TwoFactorWebAuthnResponse } from "../response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../response/two-factor-yubi-key.response";

export type TwoFactorResponse =
  | TwoFactorRecoverResponse
  | TwoFactorDuoResponse
  | TwoFactorOrganizationDuoResponse
  | TwoFactorEmailResponse
  | TwoFactorWebAuthnResponse
  | TwoFactorAuthenticatorResponse
  | TwoFactorYubiKeyResponse;
