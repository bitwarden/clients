// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "./secret-verification.request";

export class UpdateTwoFactorAuthenticatorRequest extends SecretVerificationRequest {
  token: string;
  key: string;
  userVerificationToken: string;
}
