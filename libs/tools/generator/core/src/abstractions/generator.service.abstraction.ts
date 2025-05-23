// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { PolicyEvaluator } from "./policy-evaluator.abstraction";

/** Generates credentials used for user authentication
 *  @typeParam Options the credential generation configuration
 *  @typeParam Policy the policy enforced by the generator
 * @deprecated Use {@link CredentialGeneratorService} instead.
 */
export abstract class GeneratorService<Options, Policy> {
  /** An observable monitoring the options saved to disk.
   *  The observable updates when the options are saved.
   *   @param userId: Identifies the user making the request
   */
  options$: (userId: UserId) => Observable<Options>;

  /** An observable monitoring the options used to enforce policy.
   *  The observable updates when the policy changes.
   *  @param userId: Identifies the user making the request
   */
  evaluator$: (userId: UserId) => Observable<PolicyEvaluator<Policy, Options>>;

  /** Gets the default options. */
  defaults$: (userId: UserId) => Observable<Options>;

  /** Enforces the policy on the given options
   * @param userId: Identifies the user making the request
   * @param options the options to enforce the policy on
   * @returns a new instance of the options with the policy enforced
   */
  enforcePolicy: (userId: UserId, options: Options) => Promise<Options>;

  /** Generates credentials
   * @param options the options to generate credentials with
   * @returns a promise that resolves with the generated credentials
   */
  generate: (options: Options) => Promise<string>;

  /** Saves the given options to disk.
   * @param userId: Identifies the user making the request
   * @param options the options to save
   * @returns a promise that resolves when the options are saved
   */
  saveOptions: (userId: UserId, options: Options) => Promise<void>;
}
