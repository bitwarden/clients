import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy as AdminPolicy } from "@bitwarden/common/admin-console/models/domain/policy";

import { PolicyEvaluator } from "../abstractions";

import { GeneratorConstraints } from "./generator-constraints";

/** Determines how to construct a password generator policy */
export type PolicyConfiguration<Policy, Settings> = {
  type: PolicyType;

  /** The value of the policy when it is not in effect. */
  disabledValue: Policy;

  /** Combines multiple policies set by the administrative console into
   *  a single policy.
   */
  combine: (acc: Policy, policy: AdminPolicy) => Policy;

  /** Converts policy service data into an actionable policy.
   *  @deprecated provided only for backwards compatibility.
   *   Use `toConstraints` instead.
   */
  createEvaluator: (policy: Policy) => PolicyEvaluator<Policy, Settings>;

  /** Converts policy service data into actionable policy constraints.
   *
   *  @param policy - the policy to map into policy constraints.
   *  @param email - the default email to extend.
   *
   * @remarks this version includes constraints needed for the reactive forms;
   *  it was introduced so that the constraints can be incrementally introduced
   *  as the new UI is built.
   */
  toConstraints: (policy: Policy, email: string) => GeneratorConstraints<Settings>;
};
