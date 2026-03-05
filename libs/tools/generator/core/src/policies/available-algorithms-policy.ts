import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

import { AlgorithmsByType, CredentialAlgorithm, Type } from "../metadata";

/** Reduces policies to a set of available algorithms
 *  @param policies the policies to reduce
 *  @returns the resulting `AlgorithmAvailabilityPolicy`
 */
export function availableAlgorithms(policies: Policy[]): CredentialAlgorithm[] {
  const overridePassword = policies
    .filter((policy) => policy.type === PolicyType.PasswordGenerator && policy.enabled)
    .reduce(
      (type, policy) => (type === "password" ? type : (policy.data.overridePasswordType ?? type)),
      null as CredentialAlgorithm | null,
    );

  const policy: CredentialAlgorithm[] = [
    ...AlgorithmsByType[Type.email],
    ...AlgorithmsByType[Type.username],
  ];
  if (overridePassword) {
    policy.push(overridePassword);
  } else {
    policy.push(...AlgorithmsByType[Type.password]);
  }

  return policy;
}
