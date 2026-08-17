import { AccessCondition, isHumanApproval } from "../abstractions/access-rule";

/**
 * The i18n key describing how a rule grants access: human approval when the rule carries
 * the `human_approval` condition, auto-approval otherwise.
 */
export function approvalMethodLabelKey(conditions: AccessCondition[]): string {
  return conditions.some(isHumanApproval)
    ? "pamAccessRuleConditionRequiresApproval"
    : "pamAccessRuleConditionAutoApproved";
}
