// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Constraints,
  DynamicStateConstraints,
  PolicyConstraints,
  StateConstraints,
} from "@bitwarden/common/tools/types";

import { PasswordGeneratorPolicy, PasswordGeneratorSettings } from "../types";

import { atLeast, atLeastSum, maybe, readonlyTrueWhen, AtLeastOne, Zero } from "./constraints";
import { PasswordPolicyConstraints } from "./password-policy-constraints";

/** Creates state constraints by blending policy and password settings. */
export class DynamicPasswordPolicyConstraints
  implements DynamicStateConstraints<PasswordGeneratorSettings>
{
  /** Instantiates the object.
   *  @param policy the password policy to enforce. This cannot be
   *  `null` or `undefined`.
   */
  constructor(
    policy: PasswordGeneratorPolicy,
    readonly defaults: Constraints<PasswordGeneratorSettings>,
  ) {
    const minLowercase = maybe(policy.useLowercase, AtLeastOne);
    const minUppercase = maybe(policy.useUppercase, AtLeastOne);

    const minNumber = atLeast(
      policy.numberCount || (policy.useNumbers && AtLeastOne.min),
      defaults.minNumber,
    );

    const minSpecial = atLeast(
      policy.specialCount || (policy.useSpecial && AtLeastOne.min),
      defaults.minSpecial,
    );

    const baseLength = atLeast(policy.minLength, defaults.length);
    const subLengths = [minLowercase, minUppercase, minNumber, minSpecial];
    const length = atLeastSum(baseLength, subLengths);

    this.constraints = Object.freeze({
      policyInEffect: policyInEffect(policy, defaults),
      lowercase: readonlyTrueWhen(policy.useLowercase),
      uppercase: readonlyTrueWhen(policy.useUppercase),
      number: readonlyTrueWhen(policy.useNumbers),
      special: readonlyTrueWhen(policy.useSpecial),
      length,
      minLowercase,
      minUppercase,
      minNumber,
      minSpecial,
    });
  }

  /** Constraints derived from the policy and application-defined defaults;
   *  @remarks these limits are absolute and should be transmitted to the UI
   */
  readonly constraints: PolicyConstraints<PasswordGeneratorSettings>;

  calibrate(state: PasswordGeneratorSettings): StateConstraints<PasswordGeneratorSettings> {
    // decide which constraints are active
    const lowercase = state.lowercase || this.constraints.lowercase?.requiredValue || false;
    const uppercase = state.uppercase || this.constraints.uppercase?.requiredValue || false;
    const number = state.number || this.constraints.number?.requiredValue || false;
    const special = state.special || this.constraints.special?.requiredValue || false;

    // minimum constraints cannot `atLeast(state...) because doing so would force
    // the constrained value to only increase
    const constraints: PolicyConstraints<PasswordGeneratorSettings> = {
      ...this.constraints,
      minLowercase: maybe<number>(lowercase, this.constraints.minLowercase ?? AtLeastOne),
      minUppercase: maybe<number>(uppercase, this.constraints.minUppercase ?? AtLeastOne),
      minNumber: maybe<number>(number, this.constraints.minNumber) ?? Zero,
      minSpecial: maybe<number>(special, this.constraints.minSpecial) ?? Zero,
    };

    // lower bound of length must always at least fit its sub-lengths
    constraints.length = atLeastSum(this.constraints.length, [
      atLeast(state.minNumber, constraints.minNumber),
      atLeast(state.minSpecial, constraints.minSpecial),
      atLeast(state.minLowercase, constraints.minLowercase),
      atLeast(state.minUppercase, constraints.minUppercase),
    ]);

    const stateConstraints = new PasswordPolicyConstraints(constraints);
    return stateConstraints;
  }
}

function policyInEffect(
  policy: PasswordGeneratorPolicy,
  defaults: Constraints<PasswordGeneratorSettings>,
): boolean {
  const policies = [
    policy.useUppercase,
    policy.useLowercase,
    policy.useNumbers,
    policy.useSpecial,
    policy.minLength > defaults.length.min,
    policy.numberCount > defaults.minNumber.min,
    policy.specialCount > defaults.minSpecial.min,
  ];

  return policies.includes(true);
}
