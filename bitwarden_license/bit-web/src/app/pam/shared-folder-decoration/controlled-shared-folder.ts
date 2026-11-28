import { CollectionView } from "@bitwarden/common/admin-console/models/collections";

/**
 * Whether a shared folder is under controlled access: an enabled access rule governs it. Read off
 * the collection's server-derived `hasEnabledAccessRule`, the one source every shared folder surface
 * uses (the Shared folders table's lock and the cipher form's Shared folders field), so they agree.
 * Callers still gate on `FeatureFlag.Pam`.
 */
export function controlledSharedFolder(collection: CollectionView): boolean {
  return collection.hasEnabledAccessRule === true;
}
