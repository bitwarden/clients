import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { getNestedFolderTree } from "@bitwarden/common/vault/utils/folder-utils";

/** A row of the My folders table: a top-level folder. */
export type FolderTableRow = {
  id: string;

  /** The folder's own name, without its parent path. */
  name: string;

  /** An em-dash stands in for a folder with no name. */
  displayName: string;

  /** Items in this folder and every folder nested beneath it. */
  itemCount: number;

  /** How many folders sit directly inside this one. */
  nestedFolders: number;
};

export const EMPTY_NAME_PLACEHOLDER = "—";

/** The user's top-level folders as table rows. */
export function buildFolderRows(
  folders: FolderView[],
  ciphers: CipherViewLike[],
): FolderTableRow[] {
  const realFolders = folders.filter((folder) => folder.id != null && folder.id !== "");

  const named = realFolders.filter((folder) => !!folder.name);
  const unnamed = realFolders.filter((folder) => !folder.name);

  const roots = getNestedFolderTree(named);

  const rootOf = new Map<string, string>(unnamed.map((folder) => [folder.id, folder.id]));
  for (const root of roots) {
    for (const id of subtreeIds(root)) {
      rootOf.set(id, root.node.id);
    }
  }

  const itemCounts = myFolderItemCounts(ciphers, (folderId) => rootOf.get(folderId));

  return [
    ...roots.map((root) => ({
      id: root.node.id,
      name: root.node.name,
      displayName: root.node.name.trim() ? root.node.name : EMPTY_NAME_PLACEHOLDER,
      itemCount: itemCounts.get(root.node.id) ?? 0,
      nestedFolders: root.children.length,
    })),
    ...unnamed.map((folder) => ({
      id: folder.id,
      name: "",
      displayName: EMPTY_NAME_PLACEHOLDER,
      itemCount: itemCounts.get(folder.id) ?? 0,
      nestedFolders: 0,
    })),
  ];
}

/**
 * How many active (not trashed or archived) items each folder holds, keyed by folder id. Folders with no items are
 * absent rather than zero.
 *
 * `groupOf` pools folders under a shared key — e.g. each folder under its top-level ancestor. A
 * folder it maps to `undefined` is left uncounted. Defaults to each folder being its own group.
 */
export function myFolderItemCounts(
  ciphers: CipherViewLike[],
  groupOf: (folderId: string) => string | undefined = (folderId) => folderId,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cipher of ciphers) {
    if (
      CipherViewLikeUtils.isDeleted(cipher) ||
      CipherViewLikeUtils.isArchived(cipher) ||
      cipher.folderId == null ||
      cipher.folderId === ""
    ) {
      continue;
    }
    const group = groupOf(String(cipher.folderId));
    if (group !== undefined) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return counts;
}

/** The ids of {@link node} and every folder nested beneath it. */
export function subtreeIds(node: TreeNode<FolderView>): string[] {
  return [node.node.id, ...node.children.flatMap(subtreeIds)];
}
