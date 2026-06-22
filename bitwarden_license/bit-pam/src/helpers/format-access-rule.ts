import { AccessCondition } from "../abstractions/access-rule";

/**
 * Translatable i18n key + interpolation payload for a rendered condition.
 *
 * Returning a `{ key, params }` pair (instead of a pre-formatted string) keeps
 * this helper non-Angular and lets the caller resolve the user-facing string
 * via their I18nService. The keys live in `apps/web/src/locales/en/messages.json`.
 */
export type ConditionSummary = {
  key: string;
  params?: Record<string, string | number>;
};

/**
 * Produce an i18n-ready summary for a single condition.
 *
 *   { kind: "human_approval" }                       -> pamAccessRuleHumanApproval
 *   { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }  -> pamAccessRuleIpAllowlist (count 1)
 */
export function formatCondition(condition: AccessCondition): ConditionSummary {
  switch (condition.kind) {
    case "human_approval":
      return { key: "pamAccessRuleHumanApproval" };
    case "ip_allowlist":
      return { key: "pamAccessRuleIpAllowlist", params: { count: condition.cidrs?.length ?? 0 } };
  }
}

/**
 * Summarise a full condition list. Empty list returns a single `pamAccessRuleNone`
 * entry so callers don't need to special-case empty.
 */
export function summarizeConditions(conditions: AccessCondition[]): ConditionSummary[] {
  if (conditions.length === 0) {
    return [{ key: "pamAccessRuleNone" }];
  }
  return conditions.map(formatCondition);
}

/**
 * Terse, chip-style i18n key for a single condition — the compact register used
 * by the collection callout, distinct from {@link formatCondition}'s verbose
 * labels ("Approval" vs "Human approval"). Caller resolves the key.
 */
export function summarizeConditionShort(condition: AccessCondition): string {
  switch (condition.kind) {
    case "human_approval":
      return "pamAccessRuleSummaryHumanApproval";
    case "ip_allowlist":
      return "pamAccessRuleSummaryIpAllowlist";
  }
}

/**
 * Ordered list of terse summary keys for a rule's conditions plus its
 * single-active-lease flag, in render order. An otherwise-empty summary
 * collapses to a single `pamAccessRuleSummaryNoConditions` entry. Callers
 * resolve and join the keys for display.
 */
export function summarizeRuleConditions(
  conditions: AccessCondition[],
  singleActiveLease: boolean,
): string[] {
  const keys = conditions.map(summarizeConditionShort);
  if (singleActiveLease) {
    keys.push("pamAccessRuleSummarySingleActiveLease");
  }
  return keys.length === 0 ? ["pamAccessRuleSummaryNoConditions"] : keys;
}
