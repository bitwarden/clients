// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/** Applies policy to a generation request */
export abstract class PolicyEvaluator<Policy, PolicyTarget> {
  /** The policy to enforce */
  policy: Policy;

  /** Returns true when a policy is being enforced by the evaluator.
   * @remarks `applyPolicy` should be called when a policy is not in
   *           effect to enforce the application's default policy.
   */
  policyInEffect: boolean;

  /** Apply policy to a set of options.
   *  @param options The options to build from. These options are not altered.
   *  @returns A complete generation request with policy applied.
   *  @remarks This method only applies policy overrides.
   *           Pass the result to `sanitize` to ensure consistency.
   */
  applyPolicy: (options: PolicyTarget) => PolicyTarget;

  /** Ensures internal options consistency.
   *  @param options The options to cascade. These options are not altered.
   *  @returns A new generation request with cascade applied.
   *  @remarks  This method fills null and undefined values by looking at
   *  pairs of flags and values (e.g. `number` and `minNumber`). If the flag
   *  and value are inconsistent, the flag cascades to the value.
   */
  sanitize: (options: PolicyTarget) => PolicyTarget;
}
