import type { AccessRuleView } from "../abstractions/access-rule";
import { approvalMethodLabelKeys } from "../helpers/approval-method";

/** The rule fields the summary reads. */
type SummarizableRule = Pick<AccessRuleView, "conditions" | "singleActiveLease">;

/**
 * The i18n keys summarising what a rule enforces, in a fixed order: how the rule grants access
 * first, then optional restrictions.
 *
 * Delegates the approval/IP keys to `approvalMethodLabelKeys` to stay in agreement with the
 * access-rules table; only the single-active-user addition is specific to this summary.
 *
 * Returns keys, not translated text, to stay free of `I18nService`; the template joins and
 * translates them.
 */
export function accessRuleSummaryKeys(rule: SummarizableRule): string[] {
  const keys = approvalMethodLabelKeys(rule.conditions);
  if (rule.singleActiveLease) {
    keys.push("pamAccessRuleSingleActiveUser");
  }
  return keys;
}

/**
 * The enabled rules governing `collectionId`, in the order the server returned them.
 *
 * Disabled rules are excluded, since naming one would tell an administrator their collection is
 * governed when it's not. Filtered client-side to reuse the `list` call the access-rules page
 * already makes.
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
