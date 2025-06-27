// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { MasterKey } from "../../types/key";
import { VerificationType } from "../enums/verification-type";
import { MasterPasswordPolicyResponse } from "../models/response/master-password-policy.response";

export type OtpVerification = { type: VerificationType.OTP; secret: string };
export type MasterPasswordVerification = { type: VerificationType.MasterPassword; secret: string };
export type PinVerification = { type: VerificationType.PIN; secret: string };
export type BiometricsVerification = { type: VerificationType.Biometrics };

export type VerificationWithSecret = OtpVerification | MasterPasswordVerification | PinVerification;
export type VerificationWithoutSecret = BiometricsVerification;

export type Verification = VerificationWithSecret | VerificationWithoutSecret;

export function verificationHasSecret(
  verification: Verification,
): verification is VerificationWithSecret {
  return "secret" in verification;
}

export type ServerSideVerification = OtpVerification | MasterPasswordVerification;

export type MasterPasswordVerificationResponse = {
  masterKey: MasterKey;
  kdfConfig: KdfConfig;
  email: string;
  policyOptions: MasterPasswordPolicyResponse | null;
};
