/**
 * Resolves a rule's collection ids to their display names against the org's loaded
 * collections, sorted alphabetically. Falls back to the raw id when no matching
 * collection is found (e.g. one the current user cannot see). Pure, so the collection
 * badge component and the table's text-search filter can share it.
 */
export function resolveCollectionNames(
  collectionIds: string[],
  collections: readonly { id: string; name: string }[],
): string[] {
  return collectionIds
    .map((id) => collections.find((c) => c.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b));
}
