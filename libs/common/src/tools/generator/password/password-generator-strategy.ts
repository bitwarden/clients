import { map, pipe } from "rxjs";

import { GeneratorStrategy } from "..";
import { PolicyType } from "../../../admin-console/enums";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PASSWORD_SETTINGS } from "../key-definitions";
import { reduceCollection } from "../reduce-collection.operator";

import { PasswordGenerationOptions } from "./password-generation-options";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";
import { PasswordGeneratorOptionsEvaluator } from "./password-generator-options-evaluator";
import {
  DisabledPasswordGeneratorPolicy,
  PasswordGeneratorPolicy,
  leastPrivilege,
} from "./password-generator-policy";

const ONE_MINUTE = 60 * 1000;

/** {@link GeneratorStrategy} */
export class PasswordGeneratorStrategy
  implements GeneratorStrategy<PasswordGenerationOptions, PasswordGeneratorPolicy>
{
  /** instantiates the password generator strategy.
   *  @param legacy generates the password
   */
  constructor(
    private legacy: PasswordGenerationServiceAbstraction,
    private stateProvider: StateProvider,
  ) {}

  /** {@link GeneratorStrategy.durableState} */
  durableState(id: UserId) {
    return this.stateProvider.getUser(id, PASSWORD_SETTINGS);
  }

  /** {@link GeneratorStrategy.policy} */
  get policy() {
    return PolicyType.PasswordGenerator;
  }

  get cache_ms() {
    return ONE_MINUTE;
  }

  /** {@link GeneratorStrategy.toEvaluator} */
  toEvaluator() {
    return pipe(
      reduceCollection(leastPrivilege, DisabledPasswordGeneratorPolicy),
      map((policy) => new PasswordGeneratorOptionsEvaluator(policy)),
    );
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: PasswordGenerationOptions): Promise<string> {
    return this.legacy.generatePassword({ ...options, type: "password" });
  }
}
