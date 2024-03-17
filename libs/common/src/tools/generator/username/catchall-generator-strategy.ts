import { PolicyType } from "../../../admin-console/enums";
import { Policy } from "../../../admin-console/models/domain/policy";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { GeneratorStrategy } from "../abstractions";
import { DefaultPolicyEvaluator } from "../default-policy-evaluator";
import { CATCHALL_SETTINGS } from "../key-definitions";
import { NoPolicy } from "../no-policy";

import { CatchallGenerationOptions } from "./catchall-generator-options";
import { UsernameGenerationServiceAbstraction } from "./username-generation.service.abstraction";

const ONE_MINUTE = 60 * 1000;

/** Strategy for creating usernames using a catchall email address */
export class CatchallGeneratorStrategy
  implements GeneratorStrategy<CatchallGenerationOptions, NoPolicy>
{
  /** Instantiates the generation strategy
   *  @param usernameService generates a catchall address for a domain
   */
  constructor(
    private usernameService: UsernameGenerationServiceAbstraction,
    private stateProvider: StateProvider,
  ) {}

  /** {@link GeneratorStrategy.durableState} */
  durableState(id: UserId) {
    return this.stateProvider.getUser(id, CATCHALL_SETTINGS);
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
      return new DefaultPolicyEvaluator<CatchallGenerationOptions>();
    }

    if (policy.type !== this.policy) {
      const details = `Expected: ${this.policy}. Received: ${policy.type}`;
      throw Error("Mismatched policy type. " + details);
    }

    return new DefaultPolicyEvaluator<CatchallGenerationOptions>();
  }

  /** {@link GeneratorStrategy.generate} */
  generate(options: CatchallGenerationOptions) {
    return this.usernameService.generateCatchall({
      catchallDomain: options.domain,
      catchallType: options.type,
    });
  }
}
