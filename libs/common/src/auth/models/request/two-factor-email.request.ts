// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "./secret-verification.request";

export class TwoFactorEmailRequest extends SecretVerificationRequest {
  email: string;
  deviceIdentifier: string;
  authRequestId: string;
  ssoEmail2FaSessionToken?: string;
}
