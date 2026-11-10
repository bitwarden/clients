import {
  CollectionView,
  NestingDelimiter,
} from "@bitwarden/common/admin-console/models/collections";

/**
 * A shared folder's own name, without the parent path its full name carries: "Deepest" for
 * "Top level/Next/Deeper/Deepest". Leading and trailing delimiters are ignored, as
 * `getNestedCollectionTree` ignores them.
 */
export function sharedFolderName(collection: Pick<CollectionView, "name">): string {
  const path = collection.name.replace(/^\/+|\/+$/g, "");
  return path.slice(path.lastIndexOf(NestingDelimiter) + 1) || collection.name;
}
