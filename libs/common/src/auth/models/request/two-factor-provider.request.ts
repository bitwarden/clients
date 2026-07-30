// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

import { SecretVerificationRequest } from "./secret-verification.request";

export class TwoFactorProviderRequest extends SecretVerificationRequest {
  type: TwoFactorProviderType;
}
