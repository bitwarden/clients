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
  const collectionIds = (cipher.collectionIds ?? []).map((id) => idString(id));
  return sharedFolder.some((value) => collectionIds.includes(value));
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
  return folder.some((value) =>
    value === NO_FOLDER ? !cipher.folderId : idString(cipher.folderId) === value,
  );
}
