import { Condition } from "../abstractions/access-rule";

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
export function formatCondition(condition: Condition): ConditionSummary {
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
export function summarizeConditions(conditions: Condition[]): ConditionSummary[] {
  if (conditions.length === 0) {
    return [{ key: "pamAccessRuleNone" }];
  }
  return conditions.map(formatCondition);
}
