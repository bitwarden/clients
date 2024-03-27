import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";

/** Policy options enforced during passphrase generation. */
export type PassphraseGeneratorPolicy = {
  minNumberWords: number;
  capitalize: boolean;
  includeNumber: boolean;
};

/** The default options for password generation policy. */
export const DisabledPassphraseGeneratorPolicy: PassphraseGeneratorPolicy = Object.freeze({
  minNumberWords: 0,
  capitalize: false,
  includeNumber: false,
});

/** Reduces a policy into an accumulator by accepting the most restrictive
 *  values from each policy.
 *  @param acc the accumulator
 *  @param policy the policy to reduce
 *  @returns the most restrictive values between the policy and accumulator.
 */
export function leastPrivilege(
  acc: PassphraseGeneratorPolicy,
  policy: Policy,
): PassphraseGeneratorPolicy {
  if (policy.type !== PolicyType.PasswordGenerator) {
    return acc;
  }

  return {
    minNumberWords: Math.max(acc.minNumberWords, policy.data.minNumberWords ?? acc.minNumberWords),
    capitalize: policy.data.capitalize || acc.capitalize,
    includeNumber: policy.data.includeNumber || acc.includeNumber,
  };
}
