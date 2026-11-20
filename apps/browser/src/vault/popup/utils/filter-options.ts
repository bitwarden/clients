import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ChipFilterOption } from "@bitwarden/components";
import {
  cipherInScope,
  collectionInScope,
  defaultUserCollectionIds,
  idString,
  type VaultScope,
  VaultScopeType,
  type VaultsNavViewModel,
} from "@bitwarden/vault";

/**
 * Flattens a `ChipFilterOption` tree depth-first, since scope/org visibility is decided per
 * option, not per branch. Nested rendering rebuilds nesting from the original tree instead of
 * this flat list — see `VaultPopupListTableComponent.toFilterOptionNodes`.
 */
export function flattenOptions<T>(options: ChipFilterOption<T>[]): ChipFilterOption<T>[] {
  return options.flatMap((option) => [option, ...flattenOptions(option.children ?? [])]);
}

/** The collection options a vault lists, less "My items", which the vault switcher offers instead. */
export function collectionOptionsInScope(
  collectionTree: ChipFilterOption<CollectionView>[],
  scope: VaultScope,
  nav: VaultsNavViewModel | undefined,
): ChipFilterOption<CollectionView>[] {
  const myItemsIds = defaultUserCollectionIds(nav);
  return flattenOptions(collectionTree).filter(
    (option) =>
      option.value != null &&
      !myItemsIds.has(option.value.id) &&
      collectionInScope(option.value, scope),
  );
}

/** The folder options a vault lists, narrowed against its ciphers since folders belong to none. */
export function folderOptionsInScope(
  folderTree: ChipFilterOption<FolderView>[],
  ciphers: CipherViewLike[],
  scope: VaultScope,
): ChipFilterOption<FolderView>[] {
  const options = flattenOptions(folderTree);

  if (scope.type === VaultScopeType.AllItems) {
    return options;
  }

  const inScope = ciphers.filter((cipher) => cipherInScope(cipher, scope));
  return options.filter((option) => {
    const id = option.value?.id;
    return id
      ? inScope.some((cipher) => idString(cipher.folderId) === id)
      : inScope.some((cipher) => cipher.folderId == null);
  });
}
