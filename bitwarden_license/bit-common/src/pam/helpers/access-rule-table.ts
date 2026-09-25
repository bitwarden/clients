/** Toolbar status filter for the access rules table. */
export type AccessRuleStatusFilter = "enabled" | "disabled";

/** The access rules table's combined toolbar filter. */
export type AccessRuleFilter = {
  /** Lower-cased, trimmed text matched against the rule name + collection names. */
  text: string;
  status: AccessRuleStatusFilter | null;
  /** A rule matches if it carries any of these; empty means no collection filtering. */
  collectionIds: string[];
};

/**
 * Whether a rule passes the table's combined toolbar filter. `collectionNames`
 * are the resolved display names for the rule's collections, matched against
 * the search text alongside the rule name.
 *
 * `rule.collections` is typed as plain `readonly string[]` rather than
 * `Pick<AccessRuleView, "collections">` — the SDK's `CollectionId[]` is a
 * *different* nominal brand than `@bitwarden/common`'s `CollectionId` (both are
 * plain strings underneath), so this widens the parameter to whichever the caller
 * has on hand instead of forcing a cast at every call site. An `AccessRuleView`'s
 * `collections` is still assignable here — array element types widen covariantly.
 */
export function accessRuleMatchesFilter(
  rule: { name: string; enabled: boolean; collections: readonly string[] },
  collectionNames: string[],
  filter: AccessRuleFilter,
): boolean {
  if (filter.status === "enabled" && !rule.enabled) {
    return false;
  }
  if (filter.status === "disabled" && rule.enabled) {
    return false;
  }
  if (
    filter.collectionIds.length > 0 &&
    !filter.collectionIds.some((id) => rule.collections.includes(id))
  ) {
    return false;
  }
  if (filter.text.length > 0) {
    const haystack = `${rule.name} ${collectionNames.join(" ")}`.toLowerCase();
    if (!haystack.includes(filter.text)) {
      return false;
    }
  }
  return true;
}
