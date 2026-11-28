import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Sentinel for the Vault chip's "my vault" option — organizations are identified by id, and the
 * individual vault has none.
 */
export const MY_VAULT = "myVault";

/** Sentinel for the My folders chip's "no folder" option. */
export const NO_FOLDER = "noFolder";

/**
 * Widens a branded SDK id to a plain string, or `undefined` for null/undefined inputs.
 *
 * Cipher ids are branded SDK types on `CipherListView` (`OrganizationId`, `CollectionId`,
 * `FolderId`) but plain strings on `CipherView`, so reading one off `CipherViewLike` yields a
 * union that can't key a lookup or be compared to a filter value until it's normalized.
 */
export const idString = (id: unknown): string | undefined => (id == null ? undefined : String(id));

/**
 * Set views of the multi-select chips' selected ids, built once per selection. A chip emits a
 * new array on each change, and the table passes that same array for every row in a pass and
 * through every other chip's option counts, so each row's lookup is O(1) rather than
 * O(selected). Weakly keyed, so a replaced selection's set is collected with it.
 */
const selectionSets = new WeakMap<readonly string[], ReadonlySet<string>>();

function selectionSet(selection: readonly string[]): ReadonlySet<string> {
  let set = selectionSets.get(selection);
  if (set == null) {
    set = new Set(selection);
    selectionSets.set(selection, set);
  }
  return set;
}

/**
 * Whether the cipher matches the given type filter.
 * `null` and `undefined` mean "no filter, match everything".
 */
export function matchesType(cipher: CipherViewLike, type: CipherType | null | undefined): boolean {
  // `type` differs between CipherView and CipherListView, so it must go through the utils.
  return type == null || CipherViewLikeUtils.getType(cipher) === type;
}

/**
 * Whether the cipher matches the favorites filter.
 * `false` and `undefined` mean "no filter, match everything".
 */
export function matchesFavorite(cipher: CipherViewLike, favorites: boolean | undefined): boolean {
  return !favorites || cipher.favorite;
}

/**
 * The Vault chip is multi-select: `vault` is an array of organization ids and/or
 * {@link MY_VAULT}. A cipher matches if it satisfies *any* selected value (OR).
 * `undefined` and `[]` both mean "no filter, match everything".
 */
export function matchesVault(cipher: CipherViewLike, vault: string[] | undefined): boolean {
  if (!vault || vault.length === 0) {
    return true;
  }
  return vault.some((value) =>
    value === MY_VAULT ? !cipher.organizationId : idString(cipher.organizationId) === value,
  );
}

/**
 * The Shared folders chip is multi-select: `sharedFolder` is an array of collection ids. As
 * with {@link matchesVault}, `undefined` and `[]` both mean unfiltered, and a cipher matches if
 * it belongs to *any* selected collection.
 */
export function matchesSharedFolder(
  cipher: CipherViewLike,
  sharedFolder: string[] | undefined,
): boolean {
  if (!sharedFolder || sharedFolder.length === 0) {
    return true;
  }
  const selected = selectionSet(sharedFolder);
  // A loop, not `map`: the table calls this for every row on each filter change.
  for (const id of cipher.collectionIds ?? []) {
    const collectionId = idString(id);
    if (collectionId != null && selected.has(collectionId)) {
      return true;
    }
  }
  return false;
}

/**
 * The Shared folders chip values the cipher holds: its collection ids. Must agree with
 * {@link matchesSharedFolder} — `bit-table-v2` counts the chip's options from these.
 */
export function sharedFolderValues(cipher: CipherViewLike): string[] {
  const values: string[] = [];
  for (const id of cipher.collectionIds ?? []) {
    const collectionId = idString(id);
    if (collectionId != null) {
      values.push(collectionId);
    }
  }
  return values;
}

/**
 * The My folders chip is multi-select: `folder` is an array of folder ids and/or
 * {@link NO_FOLDER}. As with {@link matchesVault}, `undefined` and `[]` both mean unfiltered,
 * and a cipher matches if it satisfies *any* selected value.
 */
export function matchesFolder(cipher: CipherViewLike, folder: string[] | undefined): boolean {
  if (!folder || folder.length === 0) {
    return true;
  }
  return selectionSet(folder).has(cipher.folderId ? String(cipher.folderId) : NO_FOLDER);
}

/**
 * The My folders chip value the cipher holds: its folder id, or {@link NO_FOLDER}. Must agree
 * with {@link matchesFolder} — `bit-table-v2` counts the chip's options from it.
 */
export function folderValues(cipher: CipherViewLike): string[] {
  return cipher.folderId ? [String(cipher.folderId)] : [NO_FOLDER];
}

/**
 * Whether the cipher matches the My items filter — membership in the given collection id.
 * `false`/`undefined` `myItems`, or an unresolved `collectionId`, mean "no filter, match everything".
 */
export function matchesMyItems(
  cipher: CipherViewLike,
  myItems: boolean | undefined,
  collectionId: string | undefined,
): boolean {
  if (!myItems || collectionId == null) {
    return true;
  }
  // Compared directly rather than through `matchesSharedFolder`: a one-element selection built
  // per call would never hit its set cache.
  for (const id of cipher.collectionIds ?? []) {
    if (idString(id) === collectionId) {
      return true;
    }
  }
  return false;
}
