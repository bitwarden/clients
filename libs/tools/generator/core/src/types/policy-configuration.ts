import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy as AdminPolicy } from "@bitwarden/common/admin-console/models/domain/policy";

import { PolicyEvaluator } from "../abstractions";

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
};
