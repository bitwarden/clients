import type { AccessRuleView } from "../abstractions/access-rule";
import { approvalMethodLabelKeys } from "../helpers/approval-method";

type SummarizableRule = Pick<AccessRuleView, "conditions" | "singleActiveLease">;

/**
 * Lists how the rule grants access first, then optional restrictions. Returns i18n keys rather than
 * text, to stay free of `I18nService`.
 */
export function accessRuleSummaryKeys(rule: SummarizableRule): string[] {
  const keys = approvalMethodLabelKeys(rule.conditions);
  if (rule.singleActiveLease) {
    keys.push("pamAccessRuleSingleActiveUser");
  }
  return keys;
}

/** Skips disabled rules, since naming one would claim a gate that isn't enforced. */
export function rulesGoverningCollection(
  rules: readonly AccessRuleView[],
  collectionId: string,
): AccessRuleView[] {
  return rules.filter(
    (rule) =>
      rule.enabled && rule.collections.some((collection) => String(collection) === collectionId),
  );
}
