import { map, pipe } from "rxjs";

import { GeneratorStrategy } from "..";
import { PolicyType } from "../../../admin-console/enums";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PASSPHRASE_SETTINGS } from "../key-definitions";
import { PasswordGenerationServiceAbstraction } from "../password/password-generation.service.abstraction";
import { reduceCollection } from "../reduce-collection.operator";

import { PassphraseGenerationOptions } from "./passphrase-generation-options";
import { PassphraseGeneratorOptionsEvaluator } from "./passphrase-generator-options-evaluator";
import {
  DisabledPassphraseGeneratorPolicy,
  PassphraseGeneratorPolicy,
  leastPrivilege,
} from "./passphrase-generator-policy";

const ONE_MINUTE = 60 * 1000;

/** {@link GeneratorStrategy} */
export class PassphraseGeneratorStrategy
  implements GeneratorStrategy<PassphraseGenerationOptions, PassphraseGeneratorPolicy>
{
  /** instantiates the password generator strategy.
   *  @param legacy generates the passphrase
   *  @param stateProvider provides durable state
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

  /** {@link GeneratorStrategy.cache_ms} */
  get cache_ms() {
    return ONE_MINUTE;
  }

  /** {@link GeneratorStrategy.toEvaluator} */
  toEvaluator() {
    return pipe(
      reduceCollection(leastPrivilege, DisabledPassphraseGeneratorPolicy),
      map((policy) => new PassphraseGeneratorOptionsEvaluator(policy)),
    );
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: PassphraseGenerationOptions): Promise<string> {
    return this.legacy.generatePassphrase({ ...options, type: "passphrase" });
  }
}
