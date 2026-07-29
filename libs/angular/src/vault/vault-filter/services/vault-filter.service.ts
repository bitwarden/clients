import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Sorts collections with default user collections at the top, sorted by organization name.
 * Remaining collections are sorted by name.
 * @param collections - The list of collections to sort.
 * @param orgs - The list of organizations to use for sorting default user collections.
 * @returns Sorted list of collections.
 */
export function sortDefaultCollections(
  collections: CollectionView[],
  orgs: Organization[] = [],
  collator: Intl.Collator,
): CollectionView[] {
  const sortedDefaultCollectionTypes = collections
    .filter((c) => c.type === CollectionTypes.DefaultUserCollection)
    .sort((a, b) => {
      const aName = orgs.find((o) => o.id === a.organizationId)?.name ?? a.organizationId;
      const bName = orgs.find((o) => o.id === b.organizationId)?.name ?? b.organizationId;
      if (!aName || !bName) {
        throw new Error("Collection does not have an organizationId.");
      }
      return collator.compare(aName, bName);
    });
  return [
    ...sortedDefaultCollectionTypes,
    ...collections.filter((c) => c.type !== CollectionTypes.DefaultUserCollection),
  ];
}
