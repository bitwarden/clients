import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";

/** Policy options enforced during password generation. */
export type PasswordGeneratorPolicy = {
  /** The minimum length of generated passwords.
   *  When this is less than or equal to zero, it is ignored.
   *  If this is less than the total number of characters required by
   *  the policy's other settings, then it is ignored.
   */
  minLength: number;

  /** When this is true, an uppercase character must be part of
   *  the generated password.
   */
  useUppercase: boolean;

  /** When this is true, a lowercase character must be part of
   *  the generated password.
   */
  useLowercase: boolean;

  /** When this is true, at least one digit must be part of the generated
   *  password.
   */
  useNumbers: boolean;

  /** The quantity of digits to include in the generated password.
   *  When this is less than or equal to zero, it is ignored.
   */
  numberCount: number;

  /** When this is true, at least one digit must be part of the generated
   *  password.
   */
  useSpecial: boolean;

  /** The quantity of special characters to include in the generated
   *  password. When this is less than or equal to zero, it is ignored.
   */
  specialCount: number;
};

/** The default options for password generation policy. */
export const DisabledPasswordGeneratorPolicy: PasswordGeneratorPolicy = Object.freeze({
  minLength: 0,
  useUppercase: false,
  useLowercase: false,
  useNumbers: false,
  numberCount: 0,
  useSpecial: false,
  specialCount: 0,
});

/** Reduces a policy into an accumulator by accepting the most restrictive
 *  values from each policy.
 *  @param acc the accumulator
 *  @param policy the policy to reduce
 *  @returns the most restrictive values between the policy and accumulator.
 */
export function leastPrivilege(acc: PasswordGeneratorPolicy, policy: Policy) {
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
