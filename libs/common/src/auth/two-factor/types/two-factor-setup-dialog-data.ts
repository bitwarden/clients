import { VerificationType } from "../../enums/verification-type";

import { TwoFactorResponse } from "./two-factor-response";

/**
 * Proof that the user re-authenticated (via master password / OTP) before managing 2FA.
 * Consumed by `UserVerificationService.buildRequest` to construct the `SecretVerificationRequest`
 * sent to the per-provider GET endpoint (or the WebAuthn challenge POST) that mints the
 * user-verification token. Subsequent per-provider PUT/DELETE calls thread that token
 * directly, not this result.
 */
export type TwoFactorUserVerificationResult = {
  secret: string;
  verificationType: VerificationType;
};

/**
 * Return type of `TwoFactorVerifyDialogComponent`. Bundles the user-verification proof
 * with the provider's current server state fetched alongside the verification step,
 * and is then passed as `DIALOG_DATA` into the per-provider 2FA setup dialogs
 * (authenticator, email, yubikey, webauthn, duo).
 */
export type TwoFactorSetupDialogData<T extends TwoFactorResponse> =
  TwoFactorUserVerificationResult & {
    response: T;
  };
