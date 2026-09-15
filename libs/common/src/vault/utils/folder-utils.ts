import { NestingDelimiter } from "../../admin-console/models/collections";
import { TreeNode } from "../models/domain/tree-node";
import { FolderView } from "../models/view/folder.view";
import { ServiceUtils } from "../service-utils";

/**
 * Builds a nested tree from folders whose names encode a path with {@link NestingDelimiter} — the
 * same name-delimited nesting {@link getNestedCollectionTree} uses for collections, so a folder
 * whose parent path is missing nests and sorts identically to a collection in that situation.
 */
export function getNestedFolderTree(folders: FolderView[]): TreeNode<FolderView>[] {
  if (!folders) {
    return [];
  }

  // Folders need to be cloned because ServiceUtils.nestedTraverse actively modifies their names,
  // and these are the same FolderView instances held in state.
  const clonedFolders = [...folders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => Object.assign(new FolderView(), f));

  const nodes: TreeNode<FolderView>[] = [];
  for (const folder of clonedFolders) {
    const parts = folder.name ? folder.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
    ServiceUtils.nestedTraverse(nodes, 0, parts, folder, undefined, NestingDelimiter);
  }
  return nodes;
}
