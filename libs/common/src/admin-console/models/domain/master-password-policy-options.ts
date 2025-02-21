// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyResponse } from "../../../auth/models/response/master-password-policy.response";
import Domain from "../../../platform/models/domain/domain-base";

export class MasterPasswordPolicyOptions extends Domain {
  minComplexity = 0;
  minLength = 0;
  requireUpper = false;
  requireLower = false;
  requireNumbers = false;
  requireSpecial = false;

  /**
   * Flag to indicate if the policy should be enforced on login.
   * If true, and the user's password does not meet the policy requirements,
   * the user will be forced to update their password.
   */
  enforceOnLogin = false;

  static fromResponse(policy: MasterPasswordPolicyResponse): MasterPasswordPolicyOptions {
    if (policy == null) {
      return null;
    }
    const options = new MasterPasswordPolicyOptions();
    options.minComplexity = policy.minComplexity;
    options.minLength = policy.minLength;
    options.requireUpper = policy.requireUpper;
    options.requireLower = policy.requireLower;
    options.requireNumbers = policy.requireNumbers;
    options.requireSpecial = policy.requireSpecial;
    options.enforceOnLogin = policy.enforceOnLogin;
    return options;
  }
}
