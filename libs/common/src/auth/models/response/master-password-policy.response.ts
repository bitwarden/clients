import { BaseResponse } from "../../../models/response/base.response";

export class MasterPasswordPolicyResponse extends BaseResponse {
  minComplexity: number;
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;

  /**
   * Flag to indicate if the policy should be enforced on login.
   * If true, and the user's password does not meet the policy requirements,
   * the user will be forced to update their password.
   */
  enforceOnLogin: boolean;

  constructor(response: any) {
    super(response);

    this.minComplexity = this.getResponseProperty("MinComplexity");
    this.minLength = this.getResponseProperty("MinLength");
    this.requireUpper = this.getResponseProperty("RequireUpper");
    this.requireLower = this.getResponseProperty("RequireLower");
    this.requireNumbers = this.getResponseProperty("RequireNumbers");
    this.requireSpecial = this.getResponseProperty("RequireSpecial");
    this.enforceOnLogin = this.getResponseProperty("EnforceOnLogin");
  }
}
