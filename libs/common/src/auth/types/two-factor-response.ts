import { TwoFactorAuthenticatorResponse } from "../models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../models/response/two-factor-email.response";
import { TwoFactorRecoverResponse } from "../models/response/two-factor-recover.response";
import { TwoFactorWebAuthnResponse } from "../models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../models/response/two-factor-yubi-key.response";

export type TwoFactorResponse =
  | TwoFactorRecoverResponse
  | TwoFactorDuoResponse
  | TwoFactorEmailResponse
  | TwoFactorWebAuthnResponse
  | TwoFactorAuthenticatorResponse
  | TwoFactorYubiKeyResponse;
