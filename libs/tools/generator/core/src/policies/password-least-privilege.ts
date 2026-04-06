import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

import { PasswordGeneratorPolicy } from "../types";

/** Reduces a policy into an accumulator by accepting the most restrictive
 *  values from each policy.
 *  @param acc the accumulator
 *  @param policy the policy to reduce
 *  @returns the most restrictive values between the policy and accumulator.
 */
export function passwordLeastPrivilege(acc: PasswordGeneratorPolicy, policy: Policy) {
  if (policy.type !== PolicyType.PasswordGenerator || !policy.enabled) {
    return acc;
  }

  return {
    minLength: Math.max(acc.minLength, policy.data.minLength ?? acc.minLength),
    useUppercase: policy.data.useUpper || acc.useUppercase,
    useLowercase: policy.data.useLower || acc.useLowercase,
    useNumbers: policy.data.useNumbers || acc.useNumbers,
    numberCount: Math.max(acc.numberCount, policy.data.minNumbers ?? acc.numberCount),
    useSpecial: policy.data.useSpecial || acc.useSpecial,
    specialCount: Math.max(acc.specialCount, policy.data.minSpecial ?? acc.specialCount),
  };
}
