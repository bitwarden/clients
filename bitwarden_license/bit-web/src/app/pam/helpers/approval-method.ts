import { AccessCondition, isHumanApproval, isIpAllowlist } from "../abstractions/access-rule";

/**
 * The i18n keys describing how a rule grants access, in display order: an approval key for
 * `human_approval`, an IP-restricted key for `ip_allowlist`. Falls back to a single
 * auto-approved key when neither is present.
 */
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
