import { SecretVerificationRequest } from "./secret-verification.request";

export class UpdateTwoFactorAuthenticatorRequest extends SecretVerificationRequest {
  token: string;
  key: string;
  userVerificationToken: string;
}
