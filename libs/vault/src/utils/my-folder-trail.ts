import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { getNestedFolderTree } from "@bitwarden/common/vault/utils/folder-utils";

import { EMPTY_NAME_PLACEHOLDER } from "../models/folder-table-row";

import { sharedFolderName } from "./shared-folder-name";

export type MyFolderCrumb = {
  id: string;

  /** The folder's own name, without its parent path. */
  name: string;
};

export type MyFolderTrail = {
  /** The folders containing it, from the top-level folder to its immediate parent. */
  ancestors: MyFolderCrumb[];

  /** The folder's own name, without its parent path. */
  current: string;
};

/**
 * Resolves the path to one of the user's folders — `undefined` when {@link folders} does not hold it.
 *
 * A folder with no name has no place in the path tree, so it can neither sit inside another folder
 * nor hold one — see `myFolderSource`. It trails flat, under an em-dash.
 */
export function resolveMyFolderTrail(
  folders: FolderView[],
  folderId: string,
): MyFolderTrail | undefined {
  const tree = getNestedFolderTree(folders.filter((folder) => !!folder.name));
  // Predates strict null checks: a miss comes back as `null` despite the signature.
  const node = ServiceUtils.getTreeNodeObjectFromList(tree, folderId) ?? undefined;

  if (node == null) {
    return folders.some((folder) => folder.id === folderId)
      ? { ancestors: [], current: EMPTY_NAME_PLACEHOLDER }
      : undefined;
  }

  const ancestors: MyFolderCrumb[] = [];
  for (let parent = node.parent; parent != null; parent = parent.parent) {
    // Read through `sharedFolderName`: the tree names a node whose parent is missing by the joined
    // path segments, not its own name.
    ancestors.unshift({ id: parent.node.id, name: sharedFolderName(parent.node) });
  }

  return { ancestors, current: sharedFolderName(node.node) };
}
