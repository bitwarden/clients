import { SecretVerificationRequest } from "./secret-verification.request";

export class UpdateTwoFactorYubikeyOtpRequest extends SecretVerificationRequest {
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  key5: string;
  nfc: boolean;
}
