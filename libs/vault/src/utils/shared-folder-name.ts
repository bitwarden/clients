import {
  CollectionView,
  NestingDelimiter,
} from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * A shared folder's own name, without the parent path its full name carries: "Deepest" for
 * "Top level/Next/Deeper/Deepest". Leading and trailing delimiters are ignored, as
 * `getNestedCollectionTree` ignores them.
 */
export function sharedFolderName(collection: Pick<CollectionView, "name">): string {
  const path = collection.name.replace(/^\/+|\/+$/g, "");
  return path.slice(path.lastIndexOf(NestingDelimiter) + 1) || collection.name;
}

/**
 * A shared folder's full name for display. The member's own "My items" collection reads from i18n
 * rather than its stored name, which the server may hold in older casing. Another member's "My
 * items" collection keeps the email its `name` resolves to, so an admin can tell them apart.
 */
export function sharedFolderDisplayName(
  collection: Pick<CollectionView, "name" | "isDefaultCollection" | "defaultUserCollectionEmail">,
  i18nService: Pick<I18nService, "t">,
): string {
  return collection.isDefaultCollection && collection.defaultUserCollectionEmail == null
    ? i18nService.t("myItemsV2")
    : collection.name;
}
