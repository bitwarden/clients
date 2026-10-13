// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";

export class TwoFactorEmailLoginRequest extends SecretVerificationRequest {
  email: string;
  deviceIdentifier: string;
  authRequestId: string;
  ssoEmail2FaSessionToken?: string;
}
