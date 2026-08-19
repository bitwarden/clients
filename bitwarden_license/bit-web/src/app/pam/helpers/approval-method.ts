import { AccessCondition, isHumanApproval, isIpAllowlist } from "../abstractions/access-rule";

/**
 * The i18n keys describing how a rule grants access, in display order: an approval key when
 * the rule carries the `human_approval` condition, an IP-restricted key when it carries the
 * `ip_allowlist` condition. When neither condition is present, falls back to a single
 * auto-approved key so the rule is never described as requiring nothing at all.
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
