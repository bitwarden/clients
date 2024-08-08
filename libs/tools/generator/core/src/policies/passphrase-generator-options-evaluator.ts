import { PolicyEvaluator } from "../abstractions";
import { DefaultPassphraseGenerationOptions, DefaultPassphraseBoundaries } from "../data";
import { Boundary, PassphraseGenerationOptions, PassphraseGeneratorPolicy } from "../types";

/** Enforces policy for passphrase generation options.
 */
export class PassphraseGeneratorOptionsEvaluator
  implements PolicyEvaluator<PassphraseGeneratorPolicy, PassphraseGenerationOptions>
{
  // This design is not ideal, but it is a step towards a more robust passphrase
  // generator. Ideally, `sanitize` would be implemented on an options class,
  // and `applyPolicy` would be implemented on a policy class, "mise en place".
  //
  // The current design of the passphrase generator, unfortunately, would require
  // a substantial rewrite to make this feasible. Hopefully this change can be
  // applied when the passphrase generator is ported to rust.

  /** Policy applied by the evaluator.
   */
  readonly policy: PassphraseGeneratorPolicy;

  /** Boundaries for the number of words allowed in the password.
   */
  readonly numWords: Boundary;

  /** Instantiates the evaluator.
   * @param policy The policy applied by the evaluator. When this conflicts with
   *               the defaults, the policy takes precedence.
   */
  constructor(policy: PassphraseGeneratorPolicy) {
    function createBoundary(value: number, defaultBoundary: Boundary): Boundary {
      const boundary = {
        min: Math.max(defaultBoundary.min, value),
        max: Math.max(defaultBoundary.max, value),
      };

      return boundary;
    }

    this.policy = structuredClone(policy);
    this.numWords = createBoundary(policy.minNumberWords, DefaultPassphraseBoundaries.numWords);
  }

  /** {@link PolicyEvaluator.policyInEffect} */
  get policyInEffect(): boolean {
    const policies = [
      this.policy.capitalize,
      this.policy.includeNumber,
      this.policy.minNumberWords > DefaultPassphraseBoundaries.numWords.min,
    ];

    return policies.includes(true);
  }

  /** Apply policy to the input options.
   *  @param options The options to build from. These options are not altered.
   *  @returns A new password generation request with policy applied.
   */
  applyPolicy(options: PassphraseGenerationOptions): PassphraseGenerationOptions {
    function fitToBounds(value: number, boundaries: Boundary) {
      const { min, max } = boundaries;

      const withUpperBound = Math.min(value ?? boundaries.min, max);
      const withLowerBound = Math.max(withUpperBound, min);

      return withLowerBound;
    }

    // apply policy overrides
    const capitalize = this.policy.capitalize || options.capitalize || false;
    const includeNumber = this.policy.includeNumber || options.includeNumber || false;

    // apply boundaries
    const numWords = fitToBounds(options.numWords, this.numWords);

    return {
      ...options,
      numWords,
      capitalize,
      includeNumber,
    };
  }

  /** Ensures internal options consistency.
   *  @param options The options to cascade. These options are not altered.
   *  @returns A passphrase generation request with cascade applied.
   */
  sanitize(options: PassphraseGenerationOptions): PassphraseGenerationOptions {
    // ensure words are separated by a single character or the empty string
    const wordSeparator =
      options.wordSeparator === ""
        ? ""
        : options.wordSeparator?.[0] ?? DefaultPassphraseGenerationOptions.wordSeparator;

    return {
      ...options,
      wordSeparator,
    };
  }
}
