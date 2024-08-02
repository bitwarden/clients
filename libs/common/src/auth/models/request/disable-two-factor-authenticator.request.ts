import { TwoFactorProviderRequest } from "./two-factor-provider.request";

export class DisableTwoFactorAuthenticatorRequest extends TwoFactorProviderRequest {
  key: string;
  userVerificationToken: string;
}
