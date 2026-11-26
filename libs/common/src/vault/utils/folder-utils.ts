import { NestingDelimiter } from "../../admin-console/models/collections";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { Utils } from "../../platform/misc/utils";
import { TreeNode } from "../models/domain/tree-node";
import { FolderView } from "../models/view/folder.view";
import { ServiceUtils } from "../service-utils";

/**
 * Builds a nested tree from folders whose names encode a path with {@link NestingDelimiter} — the
 * same name-delimited nesting {@link getNestedCollectionTree} uses for collections, so a folder
 * whose parent path is missing nests and sorts identically to a collection in that situation.
 *
 * @param i18nService Optional — when provided, uses the locale-aware collator for sorting instead
 *   of the plain `localeCompare` fallback.
 */
export function getNestedFolderTree(
  folders: FolderView[],
  i18nService?: I18nService,
): TreeNode<FolderView>[] {
  if (!folders) {
    return [];
  }

  const sortFn = i18nService
    ? Utils.getSortFunction<FolderView>(i18nService, "name")
    : (a: FolderView, b: FolderView) => a.name.localeCompare(b.name);

  // Folders need to be cloned because ServiceUtils.nestedTraverse actively modifies their names,
  // and these are the same FolderView instances held in state.
  const clonedFolders = [...folders].sort(sortFn).map((f) => Object.assign(new FolderView(), f));

  const nodes: TreeNode<FolderView>[] = [];
  for (const folder of clonedFolders) {
    const parts = folder.name ? trimNestingDelimiters(folder.name).split(NestingDelimiter) : [];
    ServiceUtils.nestedTraverse(nodes, 0, parts, folder, undefined, NestingDelimiter);
  }
  return nodes;
}

/**
 * Splits a stored folder name into the folder's own name and the path of the folder it nests
 * under, trimming the outer delimiters the same way {@link getNestedFolderTree} does.
 *
 * @example parseFolderName("Family/Home/Utilities") // { name: "Utilities", parent: "Family/Home" }
 */
export function parseFolderName(fullName: string): { name: string; parent?: string } {
  const trimmed = trimNestingDelimiters(fullName ?? "");
  const lastDelimiter = trimmed.lastIndexOf(NestingDelimiter);

  if (lastDelimiter === -1) {
    return { name: trimmed };
  }

  return {
    name: trimmed.slice(lastDelimiter + 1),
    parent: trimmed.slice(0, lastDelimiter),
  };
}

/** Joins a folder's own name onto the path of its parent; the inverse of {@link parseFolderName}. */
export function composeFolderName(parent: string | null | undefined, name: string): string {
  return parent ? `${parent}${NestingDelimiter}${name}` : name;
}

function trimNestingDelimiters(name: string): string {
  return name.replace(/^\/+|\/+$/g, "");
}
