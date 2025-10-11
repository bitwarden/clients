import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";
import { Constraints, StateConstraints } from "@bitwarden/common/tools/types";
import { SemanticLogger } from "@bitwarden/logging";

import { CredentialAlgorithm, CredentialType } from "../metadata";
import { CredentialPreference } from "../types";
import { TypeRequest } from "../types/metadata-request";

export class AvailableAlgorithmsConstraint implements StateConstraints<CredentialPreference> {
  /** Well-known constraints of `State` */
  readonly constraints: Readonly<Constraints<CredentialPreference>> = {};

  /** Creates a password policy constraints
   *  @param algorithms loads the algorithms for an algorithm type
   *  @param isAvailable returns `true` when `algorithm` is enabled by policy
   *  @param system provides logging facilities
   */
  constructor(
    readonly algorithms: (request: TypeRequest) => CredentialAlgorithm[],
    readonly isAvailable: (algorithm: CredentialAlgorithm) => boolean,
    readonly system: UserStateSubjectDependencyProvider,
  ) {
    this.log = system.log({ type: "AvailableAlgorithmsConstraint" });
  }
  private readonly log: SemanticLogger;

  adjust(preferences: CredentialPreference): CredentialPreference {
    const result: any = {};

    const types = Object.keys(preferences) as CredentialType[];
    for (const t of types) {
      result[t] = this.adjustPreference(t, preferences[t]);
    }

    return result;
  }

  private adjustPreference(type: CredentialType, preference: { algorithm: CredentialAlgorithm }) {
    if (this.isAvailable(preference.algorithm)) {
      this.log.debug({ preference, type }, "using preferred algorithm");

      return preference;
    }

    // choose a default - this algorithm is arbitrary, but stable.
    const algorithms = type ? this.algorithms({ type: type }) : [];
    const defaultAlgorithm = algorithms.find(this.isAvailable) ?? null;

    // adjust the preference
    let adjustedPreference;
    if (defaultAlgorithm) {
      adjustedPreference = {
        ...preference,
        algorithm: defaultAlgorithm,
        updated: this.system.now(),
      };
      this.log.debug(
        { preference, defaultAlgorithm, type },
        "preference not available; defaulting the algorithm",
      );
    } else {
      // FIXME: hard-code a fallback in category metadata
      this.log.warn(
        { preference, type },
        "preference not available and default algorithm not found; continuing with preference",
      );
      adjustedPreference = preference;
    }

    return adjustedPreference;
  }

  fix(preferences: CredentialPreference): CredentialPreference {
    return preferences;
  }
}
