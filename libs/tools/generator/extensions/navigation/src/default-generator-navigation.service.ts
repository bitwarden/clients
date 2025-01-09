import { BehaviorSubject, Observable, firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";
import { distinctIfShallowMatch, reduceCollection } from "@bitwarden/common/tools/rx";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultGeneratorNavigation } from "./default-generator-navigation";
import { GeneratorNavigation } from "./generator-navigation";
import { GeneratorNavigationEvaluator } from "./generator-navigation-evaluator";
import { DisabledGeneratorNavigationPolicy, preferPassword } from "./generator-navigation-policy";
import { GeneratorNavigationService } from "./generator-navigation.service.abstraction";
import { GENERATOR_SETTINGS } from "./key-definitions";

export class DefaultGeneratorNavigationService implements GeneratorNavigationService {
  /** instantiates the password generator strategy.
   * @param stateProvider provides durable state
   * @param policy provides the policy to enforce
   */
  constructor(
    private readonly stateProvider: StateProvider,
    private readonly policy: PolicyService,
  ) {}

  /** An observable monitoring the options saved to disk.
   *  The observable updates when the options are saved.
   *   @param userId: Identifies the user making the request
   */
  options$(userId: UserId): Observable<GeneratorNavigation> {
    return this.stateProvider.getUserState$(GENERATOR_SETTINGS, userId);
  }

  /** Gets the default options. */
  defaults$(userId: UserId): Observable<GeneratorNavigation> {
    return new BehaviorSubject({ ...DefaultGeneratorNavigation });
  }

  /** An observable monitoring the options used to enforce policy.
   *  The observable updates when the policy changes.
   *  @param userId: Identifies the user making the request
   */
  evaluator$(userId: UserId) {
    const evaluator$ = this.policy.getAll$(PolicyType.PasswordGenerator, userId).pipe(
      reduceCollection(preferPassword, DisabledGeneratorNavigationPolicy),
      distinctIfShallowMatch(),
      map((policy) => new GeneratorNavigationEvaluator(policy)),
    );

    return evaluator$;
  }

  /** Enforces the policy on the given options
   * @param userId: Identifies the user making the request
   * @param options the options to enforce the policy on
   * @returns a new instance of the options with the policy enforced
   */
  async enforcePolicy(userId: UserId, options: GeneratorNavigation) {
    const evaluator = await firstValueFrom(this.evaluator$(userId));
    const applied = evaluator.applyPolicy(options);
    const sanitized = evaluator.sanitize(applied);
    return sanitized;
  }

  /** Saves the navigation options to disk.
   * @param userId: Identifies the user making the request
   * @param options the options to save
   * @returns a promise that resolves when the options are saved
   */
  async saveOptions(userId: UserId, options: GeneratorNavigation): Promise<void> {
    await this.stateProvider.setUserState(GENERATOR_SETTINGS, options, userId);
  }
}
