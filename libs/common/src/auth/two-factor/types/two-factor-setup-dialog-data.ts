import { TwoFactorResponse } from "./two-factor-response";
import { TwoFactorUserVerificationResult } from "./two-factor-user-verification-result";

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
