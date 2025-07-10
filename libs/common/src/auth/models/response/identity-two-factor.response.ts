import { BaseResponse } from "../../../models/response/base.response";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

import { MasterPasswordPolicyResponse } from "./master-password-policy.response";

export class IdentityTwoFactorResponse extends BaseResponse {
  // contains available two-factor providers
  twoFactorProviders: TwoFactorProviderType[];
  // a map of two-factor providers to necessary data for completion
  twoFactorProviders2: Record<TwoFactorProviderType, Record<string, string>>;
  ssoEmail2faSessionToken: string;
  email?: string;
  masterPasswordPolicy?: MasterPasswordPolicyResponse;

  constructor(response: any) {
    super(response);
    this.twoFactorProviders = this.getResponseProperty("TwoFactorProviders");
    this.twoFactorProviders2 = this.getResponseProperty("TwoFactorProviders2");
    this.masterPasswordPolicy = new MasterPasswordPolicyResponse(
      this.getResponseProperty("MasterPasswordPolicy"),
    );

    this.ssoEmail2faSessionToken = this.getResponseProperty("SsoEmail2faSessionToken");
    this.email = this.getResponseProperty("Email");
  }
}
