import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";

export type IdentityResponse =
  | IdentityTokenResponse
  | IdentityTwoFactorResponse
  | IdentityDeviceVerificationResponse;
