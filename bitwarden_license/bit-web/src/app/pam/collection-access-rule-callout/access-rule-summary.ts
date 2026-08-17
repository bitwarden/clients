import type { AccessRuleView } from "../abstractions/access-rule";
import { isHumanApproval, isIpAllowlist } from "../abstractions/access-rule";

/** The rule fields the summary reads. */
type SummarizableRule = Pick<AccessRuleView, "conditions" | "singleActiveLease">;

/**
 * The i18n keys summarising what a rule enforces, in a fixed order — approval mode first (every rule
 * has one), then the optional restrictions.
 *
 * Returns keys rather than translated text so this stays free of `I18nService` and unit-testable
 * without one; the template joins and translates them.
 */
export function accessRuleSummaryKeys(rule: SummarizableRule): string[] {
  const keys: string[] = [
    rule.conditions.some(isHumanApproval)
      ? "pamAccessRuleConditionRequiresApproval"
      : "pamAccessRuleConditionAutoApproved",
  ];
  if (rule.conditions.some(isIpAllowlist)) {
    keys.push("pamAccessRuleConditionIpRestricted");
  }
  if (rule.singleActiveLease) {
    keys.push("pamAccessRuleSingleActiveLease");
  }
  return keys;
}

/**
 * The enabled rules governing `collectionId`, in the order the server returned them.
 *
 * Disabled rules are excluded because they gate nothing: naming one would tell an administrator
 * their collection is governed when it is not. Filtering client-side rather than asking the server
 * for one collection's rules keeps this to the `list` call the access-rules page already makes.
 */
export function rulesGoverningCollection(
  rules: readonly AccessRuleView[],
  collectionId: string,
): AccessRuleView[] {
  return rules.filter(
    (rule) =>
      rule.enabled && rule.collections.some((collection) => String(collection) === collectionId),
  );
}
