import { IdentityDeviceVerificationResponse } from "./identity-device-verification.response";
import { IdentityTokenResponse } from "./identity-token.response";
import { IdentityTwoFactorResponse } from "./identity-two-factor.response";

export type IdentityResponse =
  IdentityTokenResponse | IdentityTwoFactorResponse | IdentityDeviceVerificationResponse;
