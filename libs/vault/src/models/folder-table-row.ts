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

  const itemCounts = new Map<string, number>();
  for (const cipher of ciphers) {
    if (
      CipherViewLikeUtils.isDeleted(cipher) ||
      cipher.folderId == null ||
      cipher.folderId === ""
    ) {
      continue;
    }
    const rootId = rootOf.get(String(cipher.folderId));
    if (rootId !== undefined) {
      itemCounts.set(rootId, (itemCounts.get(rootId) ?? 0) + 1);
    }
  }

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

function subtreeIds(node: TreeNode<FolderView>): string[] {
  return [node.node.id, ...node.children.flatMap(subtreeIds)];
}
