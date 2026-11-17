import { AccessCondition, isHumanApproval, isIpAllowlist } from "../abstractions/access-rule";

/** The i18n keys describing how a rule grants access, in display order. */
export function approvalMethodLabelKeys(conditions: AccessCondition[]): string[] {
  const keys: string[] = [];
  if (conditions.some(isHumanApproval)) {
    keys.push("pamAccessRuleConditionRequiresApproval");
  }
  if (conditions.some(isIpAllowlist)) {
    keys.push("pamAccessRuleConditionIpRestricted");
  }
  return keys.length > 0 ? keys : ["pamAccessRuleConditionAutoApproved"];
}
