// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Constraints } from "@bitwarden/common/tools/types";

import { PolicyEvaluator } from "../abstractions";
import { DefaultPasswordBoundaries } from "../data";
import { Boundary, PasswordGeneratorPolicy, PasswordGenerationOptions } from "../types";

/** Enforces policy for password generation.
 */
export class PasswordGeneratorOptionsEvaluator
  implements
    PolicyEvaluator<PasswordGeneratorPolicy, PasswordGenerationOptions>,
    Constraints<PasswordGenerationOptions>
{
  // Constraints<PasswordGenerationOptions> compatibility
  get minNumber() {
    return this.minDigits;
  }

  get minSpecial() {
    return this.minSpecialCharacters;
  }

  // This design is not ideal, but it is a step towards a more robust password
  // generator. Ideally, `sanitize` would be implemented on an options class,
  // and `applyPolicy` would be implemented on a policy class, "mise en place".
  //
  // The current design of the password generator, unfortunately, would require
  // a substantial rewrite to make this feasible. Hopefully this change can be
  // applied when the password generator is ported to rust.

  /** Boundaries for the password length. This is always large enough
   * to accommodate the minimum number of digits and special characters.
   */
  readonly length: Boundary;

  /** Boundaries for the minimum number of digits allowed in the password.
   */
  readonly minDigits: Boundary;

  /** Boundaries for the minimum number of special characters allowed
   *  in the password.
   */
  readonly minSpecialCharacters: Boundary;

  /** Policy applied by the evaluator.
   */
  readonly policy: PasswordGeneratorPolicy;

  /** Instantiates the evaluator.
   * @param policy The policy applied by the evaluator. When this conflicts with
   *               the defaults, the policy takes precedence.
   */
  constructor(policy: PasswordGeneratorPolicy) {
    function createBoundary(value: number, defaultBoundary: Boundary): Boundary {
      const boundary = {
        min: Math.max(defaultBoundary.min, value),
        max: Math.max(defaultBoundary.max, value),
      };

      return boundary;
    }

    this.policy = structuredClone(policy);
    this.minDigits = createBoundary(policy.numberCount, DefaultPasswordBoundaries.minDigits);
    this.minSpecialCharacters = createBoundary(
      policy.specialCount,
      DefaultPasswordBoundaries.minSpecialCharacters,
    );

    // the overall length should be at least as long as the sum of the minimums
    const minConsistentLength = this.minDigits.min + this.minSpecialCharacters.min;
    const minPolicyLength =
      policy.minLength > 0 ? policy.minLength : DefaultPasswordBoundaries.length.min;
    const minLength = Math.max(
      minPolicyLength,
      minConsistentLength,
      DefaultPasswordBoundaries.length.min,
    );

    this.length = {
      min: minLength,
      max: Math.max(DefaultPasswordBoundaries.length.max, minLength),
    };
  }

  /** {@link PolicyEvaluator.policyInEffect} */
  get policyInEffect(): boolean {
    const policies = [
      this.policy.useUppercase,
      this.policy.useLowercase,
      this.policy.useNumbers,
      this.policy.useSpecial,
      this.policy.minLength > DefaultPasswordBoundaries.length.min,
      this.policy.numberCount > DefaultPasswordBoundaries.minDigits.min,
      this.policy.specialCount > DefaultPasswordBoundaries.minSpecialCharacters.min,
    ];

    return policies.includes(true);
  }

  /** {@link PolicyEvaluator.applyPolicy} */
  applyPolicy(options: PasswordGenerationOptions): PasswordGenerationOptions {
    function fitToBounds(value: number, boundaries: Boundary) {
      const { min, max } = boundaries;

      const withUpperBound = Math.min(value || 0, max);
      const withLowerBound = Math.max(withUpperBound, min);

      return withLowerBound;
    }

    // apply policy overrides
    const uppercase = this.policy.useUppercase || options.uppercase || false;
    const lowercase = this.policy.useLowercase || options.lowercase || false;

    // these overrides can cascade numeric fields to boolean fields
    const number = this.policy.useNumbers || options.number || options.minNumber > 0;
    const special = this.policy.useSpecial || options.special || options.minSpecial > 0;

    // apply boundaries; the boundaries can cascade boolean fields to numeric fields
    const length = fitToBounds(options.length, this.length);
    const minNumber = fitToBounds(options.minNumber, this.minDigits);
    const minSpecial = fitToBounds(options.minSpecial, this.minSpecialCharacters);

    return {
      ...options,
      length,
      uppercase,
      lowercase,
      number,
      minNumber,
      special,
      minSpecial,
    };
  }

  /** {@link PolicyEvaluator.sanitize} */
  sanitize(options: PasswordGenerationOptions): PasswordGenerationOptions {
    function cascade(enabled: boolean, value: number): [boolean, number] {
      const enabledResult = enabled ?? value > 0;
      const valueResult = enabledResult ? value || 1 : 0;

      return [enabledResult, valueResult];
    }

    const [lowercase, minLowercase] = cascade(options.lowercase, options.minLowercase);
    const [uppercase, minUppercase] = cascade(options.uppercase, options.minUppercase);
    const [number, minNumber] = cascade(options.number, options.minNumber);
    const [special, minSpecial] = cascade(options.special, options.minSpecial);

    // minimums can only increase the length
    const minConsistentLength = minLowercase + minUppercase + minNumber + minSpecial;
    const minLength = Math.max(minConsistentLength, this.length.min);
    const length = Math.max(options.length ?? minLength, minLength);

    return {
      ...options,
      length,
      minLength,
      lowercase,
      minLowercase,
      uppercase,
      minUppercase,
      number,
      minNumber,
      special,
      minSpecial,
    };
  }
}
