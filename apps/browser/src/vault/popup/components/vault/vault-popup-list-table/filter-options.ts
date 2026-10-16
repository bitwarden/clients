import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ChipFilterOption } from "@bitwarden/components";
import { cipherInScope, idString, type VaultScope, VaultScopeType } from "@bitwarden/vault";

/**
 * Flattens a `ChipFilterOption` tree depth-first, since scope/org visibility is decided per
 * option, not per branch. Nested rendering rebuilds nesting from the original tree instead of
 * this flat list — see `VaultPopupListTableComponent.toFilterOptionNodes`.
 */
export function flattenOptions<T>(options: ChipFilterOption<T>[]): ChipFilterOption<T>[] {
  return options.flatMap((option) => [option, ...flattenOptions(option.children ?? [])]);
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
