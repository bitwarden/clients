// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TwoFactorProviderRequest } from "./two-factor-provider.request";

export class DisableTwoFactorAuthenticatorRequest extends TwoFactorProviderRequest {
  key: string;
  userVerificationToken: string;
}
