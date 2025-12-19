// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AlgorithmsByType, PolicyEvaluator, Type } from "@bitwarden/generator-core";

import { DefaultGeneratorNavigation } from "./default-generator-navigation";
import { GeneratorNavigation } from "./generator-navigation";
import { GeneratorNavigationPolicy } from "./generator-navigation-policy";

/** Enforces policy for generator navigation options.
 */
export class GeneratorNavigationEvaluator
  implements PolicyEvaluator<GeneratorNavigationPolicy, GeneratorNavigation>
{
  /** Instantiates the evaluator.
   * @param policy The policy applied by the evaluator. When this conflicts with
   *               the defaults, the policy takes precedence.
   */
  constructor(readonly policy: GeneratorNavigationPolicy) {}

  /** {@link PolicyEvaluator.policyInEffect} */
  get policyInEffect(): boolean {
    return AlgorithmsByType[Type.password].includes(this.policy?.overridePasswordType);
  }

  /** Apply policy to the input options.
   *  @param options The options to build from. These options are not altered.
   *  @returns A new password generation request with policy applied.
   */
  applyPolicy(options: GeneratorNavigation): GeneratorNavigation {
    const result = { ...options };

    if (this.policyInEffect) {
      result.type = this.policy.overridePasswordType ?? result.type;
    }

    return result;
  }

  /** Ensures internal options consistency.
   *  @param options The options to cascade. These options are not altered.
   *  @returns A passphrase generation request with cascade applied.
   */
  sanitize(options: GeneratorNavigation): GeneratorNavigation {
    return {
      ...options,
      type: options.type ?? DefaultGeneratorNavigation.type,
    };
  }
}
