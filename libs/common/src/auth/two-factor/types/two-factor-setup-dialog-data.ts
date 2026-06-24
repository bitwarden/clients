import { VerificationType } from "../../enums/verification-type";

import { TwoFactorResponse } from "./two-factor-response";

/**
 * Proof that the user re-authenticated (via master password / OTP) before managing 2FA.
 * Threaded into request DTOs for the per-provider PUT/DELETE endpoints via
 * `UserVerificationService.buildRequest`.
 */
export type TwoFactorUserVerificationResult = {
  secret: string;
  verificationType: VerificationType;
};

/**
 * Payload passed as `DIALOG_DATA` into per-provider 2FA setup dialogs. Bundles the
 * user-verification proof with the provider's current server state fetched alongside
 * the verification step.
 */
export type TwoFactorSetupDialogData<T extends TwoFactorResponse> =
  TwoFactorUserVerificationResult & {
    response: T;
  };
