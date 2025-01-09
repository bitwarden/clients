import { PolicyEvaluator } from "../abstractions";
import { NoPolicy } from "../types";

/** A policy evaluator that does not apply any policy */
export class DefaultPolicyEvaluator<PolicyTarget>
  implements PolicyEvaluator<NoPolicy, PolicyTarget>
{
  /** {@link PolicyEvaluator.policy} */
  get policy() {
    return {};
  }

  /** {@link PolicyEvaluator.policyInEffect} */
  get policyInEffect() {
    return false;
  }

  /** {@link PolicyEvaluator.applyPolicy} */
  applyPolicy(options: PolicyTarget) {
    return options;
  }

  /** {@link PolicyEvaluator.sanitize} */
  sanitize(options: PolicyTarget) {
    return options;
  }
}
