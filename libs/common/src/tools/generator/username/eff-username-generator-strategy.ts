import { PolicyType } from "../../../admin-console/enums";
import { Policy } from "../../../admin-console/models/domain/policy";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { GeneratorStrategy } from "../abstractions";
import { DefaultPolicyEvaluator } from "../default-policy-evaluator";
import { EFF_USERNAME_SETTINGS } from "../key-definitions";
import { NoPolicy } from "../no-policy";

import { EffUsernameGenerationOptions } from "./eff-username-generator-options";
import { UsernameGenerationServiceAbstraction } from "./username-generation.service.abstraction";

const ONE_MINUTE = 60 * 1000;

/** Strategy for creating usernames from the EFF wordlist */
export class EffUsernameGeneratorStrategy
  implements GeneratorStrategy<EffUsernameGenerationOptions, NoPolicy>
{
  /** Instantiates the generation strategy
   *  @param usernameService generates a username from EFF word list
   */
  constructor(
    private usernameService: UsernameGenerationServiceAbstraction,
    private stateProvider: StateProvider,
  ) {}

  /** {@link GeneratorStrategy.durableState} */
  durableState(id: UserId) {
    return this.stateProvider.getUser(id, EFF_USERNAME_SETTINGS);
  }

  /** {@link GeneratorStrategy.policy} */
  get policy() {
    // Uses password generator since there aren't policies
    // specific to usernames.
    return PolicyType.PasswordGenerator;
  }

  /** {@link GeneratorStrategy.cache_ms} */
  get cache_ms() {
    return ONE_MINUTE;
  }

  /** {@link GeneratorStrategy.evaluator} */
  evaluator(policy: Policy) {
    if (!policy) {
      return new DefaultPolicyEvaluator<EffUsernameGenerationOptions>();
    }

    if (policy.type !== this.policy) {
      const details = `Expected: ${this.policy}. Received: ${policy.type}`;
      throw Error("Mismatched policy type. " + details);
    }

    return new DefaultPolicyEvaluator<EffUsernameGenerationOptions>();
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: EffUsernameGenerationOptions) {
    return this.usernameService.generateWord(options);
  }
}
