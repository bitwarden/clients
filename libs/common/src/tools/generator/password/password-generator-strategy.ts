import { GeneratorStrategy } from "..";
import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PASSWORD_SETTINGS } from "../key-definitions";

import { PasswordGenerationOptions } from "./password-generation-options";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";
import { PasswordGeneratorOptionsEvaluator } from "./password-generator-options-evaluator";
import {
  DisabledPasswordGeneratorPolicy,
  PasswordGeneratorPolicy,
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

  /** {@link GeneratorStrategy.evaluator} */
  evaluator(policy: Policy): PasswordGeneratorOptionsEvaluator {
    if (!policy) {
      return new PasswordGeneratorOptionsEvaluator(DisabledPasswordGeneratorPolicy);
    }

    if (policy.type !== this.policy) {
      const details = `Expected: ${this.policy}. Received: ${policy.type}`;
      throw Error("Mismatched policy type. " + details);
    }

    return new PasswordGeneratorOptionsEvaluator({
      minLength: policy.data.minLength,
      useUppercase: policy.data.useUpper,
      useLowercase: policy.data.useLower,
      useNumbers: policy.data.useNumbers,
      numberCount: policy.data.minNumbers,
      useSpecial: policy.data.useSpecial,
      specialCount: policy.data.minSpecial,
    });
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: PasswordGenerationOptions): Promise<string> {
    return this.legacy.generatePassword({ ...options, type: "password" });
  }
}
