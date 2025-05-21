// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PasswordType } from "@bitwarden/generator-core";

/** Policy settings affecting password generator navigation */
export type GeneratorNavigationPolicy = {
  /** The type of generator that should be shown by default when opening
   *  the password generator.
   */
  overridePasswordType?: PasswordType;
};

/** Reduces a policy into an accumulator by preferring the password generator
 *  type to other generator types.
 *  @param acc the accumulator
 *  @param policy the policy to reduce
 *  @returns the resulting `GeneratorNavigationPolicy`
 */
export function preferPassword(
  acc: GeneratorNavigationPolicy,
  policy: Policy,
): GeneratorNavigationPolicy {
  const isEnabled = policy.type === PolicyType.PasswordGenerator && policy.enabled;
  if (!isEnabled) {
    return acc;
  }

  const isOverridable = acc.overridePasswordType !== "password" && policy.data.overridePasswordType;
  const result = isOverridable
    ? { ...acc, overridePasswordType: policy.data.overridePasswordType }
    : acc;

  return result;
}

/** The default options for password generation policy. */
export const DisabledGeneratorNavigationPolicy: GeneratorNavigationPolicy = Object.freeze({
  overridePasswordType: null,
});
