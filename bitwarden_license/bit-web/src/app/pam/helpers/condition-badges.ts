import type { BitwardenIcon } from "@bitwarden/components";

import { AccessCondition, isHumanApproval, isIpAllowlist } from "../abstractions/access-rule";

/** A condition rendered as an icon + i18n label key. */
export type ConditionBadge = {
  icon: BitwardenIcon;
  labelKey: string;
};

/**
 * Presentation badges summarizing a rule's conditions: an approval badge (required vs
 * auto-approved) always, plus an ip-restricted badge when the rule has an ip allowlist.
 */
export function conditionBadges(conditions: AccessCondition[]): ConditionBadge[] {
  const badges: ConditionBadge[] = [];
  const requiresApproval = conditions.some(isHumanApproval);
  badges.push(
    requiresApproval
      ? { icon: "bwi-users", labelKey: "pamAccessRuleConditionRequiresApproval" }
      : { icon: "bwi-check", labelKey: "pamAccessRuleConditionAutoApproved" },
  );
  if (conditions.some(isIpAllowlist)) {
    badges.push({ icon: "bwi-globe", labelKey: "pamAccessRuleConditionIpRestricted" });
  }
  return badges;
}
