import { Guid } from "../../../types/guid";

import { SecretVerificationRequest } from "./secret-verification.request";

export class TwoFactorEmailRequest extends SecretVerificationRequest {
  email: string;
  deviceIdentifier: string;
  authRequestId: Guid;
}
