/** Sorted display names, falling back to the raw id for a collection the user cannot see. */
export function resolveCollectionNames(
  collectionIds: string[],
  collections: readonly { id: string; name: string }[],
): string[] {
  return collectionIds
    .map((id) => collections.find((c) => c.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b));
}
