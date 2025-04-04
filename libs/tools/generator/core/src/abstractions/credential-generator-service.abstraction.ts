import { Observable } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BoundDependency, OnDependency } from "@bitwarden/common/tools/dependencies";
import { VendorId } from "@bitwarden/common/tools/extension";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";

import {
  CredentialAlgorithm,
  GeneratorMetadata,
  GeneratorProfile,
  CredentialType,
} from "../metadata";
import { AlgorithmMetadata } from "../metadata/algorithm-metadata";
import {
  CredentialPreference,
  ForwarderOptions,
  GeneratedCredential,
  GenerateRequest,
} from "../types";
import { GeneratorConstraints } from "../types/generator-constraints";

/** Generates credentials used in identity and/or authentication flows.
 *  @remarks typically this is for use outside of Bitwarden.
 */
export abstract class CredentialGeneratorService {
  /** Generates a stream of credentials
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.on$ Required. A new credential is emitted when this emits.
   */
  abstract generate$: (
    dependencies: OnDependency<GenerateRequest> & BoundDependency<"account", Account>,
  ) => Observable<GeneratedCredential>;

  /** Emits metadata concerning the provided generation algorithms
   *  @param category the category or categories of interest
   *  @param dependences.account$ algorithms are filtered to only
   *   those matching the provided account's policy.
   *  @returns An observable that emits algorithm metadata.
   */
  abstract algorithms$: (
    type: CredentialType,
    dependencies: BoundDependency<"account", Account>,
  ) => Observable<AlgorithmMetadata[]>;

  /** Lists metadata for the algorithms in a credential category
   *  @param type the category or categories of interest
   *  @returns A list containing the requested metadata.
   */
  abstract algorithms: (type: CredentialType | CredentialType[]) => AlgorithmMetadata[];

  /** Look up the metadata for a specific generator algorithm
   *  @param id identifies the algorithm
   *  @returns the requested metadata, or `null` if the metadata wasn't found.
   */
  abstract algorithm: (id: CredentialAlgorithm) => AlgorithmMetadata;

  /** Look up the forwarder metadata for a vendor. */
  abstract forwarder: (id: VendorId) => GeneratorMetadata<ForwarderOptions>;

  /** Get a subject bound to credential generator preferences.
   *  @param dependencies.account$ identifies the account to which the preferences are bound
   *  @returns a subject bound to the user's preferences
   *  @remarks Preferences determine which algorithms are used when generating a
   *   credential from a credential category (e.g. `PassX` or `Username`). Preferences
   *   should not be used to hold navigation history. Use @bitwarden/generator-navigation
   *   instead.
   */
  abstract preferences: (
    dependencies: BoundDependency<"account", Account>,
  ) => UserStateSubject<CredentialPreference>;

  /** Get a subject bound to a specific user's settings
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.account$ identifies the account to which the settings are bound
   * @returns a subject bound to the requested user's generator settings
   * @remarks the subject enforces policy for the settings
   */
  abstract settings: <Settings extends object>(
    metadata: Readonly<GeneratorMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
    profile?: GeneratorProfile,
  ) => UserStateSubject<Settings>;

  /** Get the policy constraints for the provided configuration
   *  @param dependencies.account$ determines which user's policy is loaded
   *  @returns an observable that emits the policy once `dependencies.account$`
   *   and the policy become available.
   */
  abstract policy$: <Settings>(
    metadata: Readonly<GeneratorMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
    profile?: GeneratorProfile,
  ) => Observable<GeneratorConstraints<Settings>>;
}
