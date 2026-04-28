import {
  Constraints,
  PolicyConstraints,
  StateConstraints,
  WithConstraints,
} from "@bitwarden/common/tools/types";
import { unconstrained } from "@bitwarden/common/tools/util";

import { DefaultPassphraseGenerationOptions } from "../data";
import { PassphraseGenerationOptions, PassphraseGeneratorPolicy } from "../types";

import { atLeast, enforceConstant, fitLength, fitToBounds, readonlyTrueWhen } from "./constraints";

export class PassphrasePolicyConstraints implements StateConstraints<PassphraseGenerationOptions> {
  /** Creates a passphrase policy constraints
   *  @param policy the password policy to enforce. This cannot be
   *  `null` or `undefined`.
   */
  constructor(
    readonly policy: PassphraseGeneratorPolicy,
    readonly defaults: Constraints<PassphraseGenerationOptions>,
  ) {
    this.constraints = {
      policyInEffect: policyInEffect(policy, defaults),
      wordSeparator: { minLength: 0, maxLength: 1 },
      capitalize: readonlyTrueWhen(policy.capitalize),
      includeNumber: readonlyTrueWhen(policy.includeNumber),
      numWords: atLeast(policy.minNumberWords, defaults.numWords),
    };
  }

  constraints: Readonly<PolicyConstraints<PassphraseGenerationOptions>>;

  adjust(state: PassphraseGenerationOptions): WithConstraints<PassphraseGenerationOptions> {
    const defaults = DefaultPassphraseGenerationOptions;
    const result: PassphraseGenerationOptions = {
      wordSeparator: fitLength(
        state.wordSeparator ?? defaults.wordSeparator!,
        this.constraints.wordSeparator!,
        { fillString: defaults.wordSeparator },
      ),
      capitalize: enforceConstant(
        state.capitalize ?? defaults.capitalize!,
        this.constraints.capitalize!,
      ),
      includeNumber: enforceConstant(
        state.includeNumber ?? defaults.includeNumber!,
        this.constraints.includeNumber!,
      ),
      numWords: fitToBounds(state.numWords ?? defaults.numWords!, this.constraints.numWords!),
    };

    // compute applied constraints (only fields that changed)
    const applied: Constraints<PassphraseGenerationOptions> = {};
    const keys: (keyof PassphraseGenerationOptions)[] = [
      "wordSeparator",
      "capitalize",
      "includeNumber",
      "numWords",
    ];
    for (const key of keys) {
      if (state[key] !== result[key] && this.constraints[key] != null) {
        (applied as any)[key] = this.constraints[key];
      }
    }

    return {
      state: result,
      constraints: this.constraints,
      applied: Object.keys(applied).length > 0 ? applied : unconstrained(),
    };
  }

  fix(state: PassphraseGenerationOptions): WithConstraints<PassphraseGenerationOptions> {
    return { state, constraints: this.constraints, applied: unconstrained() };
  }
}

function policyInEffect(
  policy: PassphraseGeneratorPolicy,
  defaults: Constraints<PassphraseGenerationOptions>,
): boolean {
  const policies = [
    policy.capitalize,
    policy.includeNumber,
    policy.minNumberWords > (defaults.numWords?.min ?? 0),
  ];

  return policies.includes(true);
}
