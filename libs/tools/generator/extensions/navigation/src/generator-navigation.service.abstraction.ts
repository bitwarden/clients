import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { PolicyEvaluator } from "@bitwarden/generator-core";

import { GeneratorNavigation } from "./generator-navigation";
import { GeneratorNavigationPolicy } from "./generator-navigation-policy";

/** Loads and stores generator navigational data
 */
export abstract class GeneratorNavigationService {
  /** An observable monitoring the options saved to disk.
   *  The observable updates when the options are saved.
   *   @param userId: Identifies the user making the request
   */
  abstract options$(userId: UserId): Observable<GeneratorNavigation>;

  /** Gets the default options. */
  abstract defaults$(userId: UserId): Observable<GeneratorNavigation>;

  /** An observable monitoring the options used to enforce policy.
   *  The observable updates when the policy changes.
   *  @param userId: Identifies the user making the request
   */
  abstract evaluator$(
    userId: UserId,
  ): Observable<PolicyEvaluator<GeneratorNavigationPolicy, GeneratorNavigation>>;

  /** Enforces the policy on the given options
   * @param userId: Identifies the user making the request
   * @param options the options to enforce the policy on
   * @returns a new instance of the options with the policy enforced
   */
  abstract enforcePolicy(
    userId: UserId,
    options: GeneratorNavigation,
  ): Promise<GeneratorNavigation>;

  /** Saves the navigation options to disk.
   * @param userId: Identifies the user making the request
   * @param options the options to save
   * @returns a promise that resolves when the options are saved
   */
  abstract saveOptions(userId: UserId, options: GeneratorNavigation): Promise<void>;
}
