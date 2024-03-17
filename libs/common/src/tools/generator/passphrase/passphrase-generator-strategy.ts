import { GeneratorStrategy } from "..";
import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PASSPHRASE_SETTINGS } from "../key-definitions";
import { PasswordGenerationServiceAbstraction } from "../password/password-generation.service.abstraction";

import { PassphraseGenerationOptions } from "./passphrase-generation-options";
import { PassphraseGeneratorOptionsEvaluator } from "./passphrase-generator-options-evaluator";
import {
  DisabledPassphraseGeneratorPolicy,
  PassphraseGeneratorPolicy,
} from "./passphrase-generator-policy";

const ONE_MINUTE = 60 * 1000;

/** {@link GeneratorStrategy} */
export class PassphraseGeneratorStrategy
  implements GeneratorStrategy<PassphraseGenerationOptions, PassphraseGeneratorPolicy>
{
  /** instantiates the password generator strategy.
   *  @param legacy generates the passphrase
   */
  constructor(
    private legacy: PasswordGenerationServiceAbstraction,
    private stateProvider: StateProvider,
  ) {}

  /** {@link GeneratorStrategy.durableState} */
  durableState(id: UserId) {
    return this.stateProvider.getUser(id, PASSPHRASE_SETTINGS);
  }

  /** {@link GeneratorStrategy.policy} */
  get policy() {
    return PolicyType.PasswordGenerator;
  }

  get cache_ms() {
    return ONE_MINUTE;
  }

  /** {@link GeneratorStrategy.evaluator} */
  evaluator(policy: Policy): PassphraseGeneratorOptionsEvaluator {
    if (!policy) {
      return new PassphraseGeneratorOptionsEvaluator(DisabledPassphraseGeneratorPolicy);
    }

    if (policy.type !== this.policy) {
      const details = `Expected: ${this.policy}. Received: ${policy.type}`;
      throw Error("Mismatched policy type. " + details);
    }

    return new PassphraseGeneratorOptionsEvaluator({
      minNumberWords: policy.data.minNumberWords,
      capitalize: policy.data.capitalize,
      includeNumber: policy.data.includeNumber,
    });
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: PassphraseGenerationOptions): Promise<string> {
    return this.legacy.generatePassphrase({ ...options, type: "passphrase" });
  }
}
