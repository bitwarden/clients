import { VerificationType } from "../../enums/verification-type";

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
