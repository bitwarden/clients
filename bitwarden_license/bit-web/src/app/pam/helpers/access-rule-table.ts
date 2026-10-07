export type AccessRuleStatusFilter = "enabled" | "disabled";

export type AccessRuleFilter = {
  /** Lower-cased, trimmed text matched against the rule name + collection names. */
  text: string;
  status: AccessRuleStatusFilter | null;
  /** A rule matches if it carries any of these; empty means no collection filtering. */
  collectionIds: string[];
};

/**
 * `rule.collections` is plain `string[]` because the SDK's and `@bitwarden/common`'s `CollectionId`
 * are different brands, so either is assignable without a cast.
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
