import type { AccessRuleId, AccessRuleView } from "../abstractions/access-rule";

/**
 * Mirrors `AccessRuleWriteValidator`, which ignores whether the owning rule is enabled, so
 * filtering on `enabled` here would leave a rejection unnamed.
 */
export function conflictingCollectionIds(
  rules: readonly AccessRuleView[],
  selectedCollectionIds: readonly string[],
  existingRuleId?: AccessRuleId,
): string[] {
  const excluded = existingRuleId == null ? null : String(existingRuleId);
  const governed = new Set(
    rules
      .filter((rule) => String(rule.id) !== excluded)
      .flatMap((rule) => rule.collections.map(String)),
  );
  return selectedCollectionIds.filter((id) => governed.has(id));
}
