import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils/collection-utils";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { BitwardenIcon } from "@bitwarden/components";

import {
  scopedSharedFolderId,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";
import { sharedFolderName } from "../../utils/shared-folder-name";

/** A single child folder, resolved to the route its card links to. */
export type CardGridCard = {
  id: string;
  name: string;
  commands: string[];

  icon: BitwardenIcon;

  /** How many folders sit directly inside this one. */
  nestedCount: number;
};

/** The i18n keys of a message that counts folders: one for exactly one, one for any other number. */
export type CountKeys = { singular: string; plural: string };

/**
 * What the card grid renders for a scope: the folder in view, its child cards, and the copy and
 * icon that go with the kind of folder they are. The grid reads this and nothing else, so it holds
 * no knowledge of which kind of folder it is showing.
 */
export type CardGridSource = {
  /** The own name of the folder in view, titling the grid. */
  parentName: string;

  /** The direct children of the folder in view, in display order. */
  cards: CardGridCard[];

  /** The i18n key of the grid's title, which takes {@link parentName}. */
  titleKey: string;

  /** The messages for the sentence counting {@link cards}. */
  countKeys: CountKeys;

  /** The messages for each card's subtext, counting the folders nested inside it. */
  nestedKeys: CountKeys;
};

/** The folders the grid draws from: the collections of the vault in view. */
export type CardGridData = {
  collections: CollectionView[];
};

/**
 * Resolves what the grid shows for a scope — `undefined` for a scope that names no folder, or one
 * {@link data} does not hold.
 */
export function resolveCardGridSource(
  scope: VaultScope,
  data: CardGridData,
): CardGridSource | undefined {
  return sharedFolderSource(scope, data.collections);
}

function sharedFolderSource(
  scope: VaultScope,
  collections: CollectionView[],
): CardGridSource | undefined {
  const collectionId = scopedSharedFolderId(scope);
  if (collectionId == null) {
    return undefined;
  }

  const node = findNode(getNestedCollectionTree(collections), collectionId);
  if (node == null) {
    return undefined;
  }

  return {
    // Read through `sharedFolderName`: the tree names a node whose parent is missing by the joined
    // path segments, not its own name.
    parentName: sharedFolderName(node.node),
    cards: node.children.map(({ node: child, children }) => ({
      id: child.id,
      name: sharedFolderName(child),
      commands: sharedFolderRoute(scope, child),
      icon: "bwi-shared-folder",
      nestedCount: children.length,
    })),
    titleKey: "sharedFoldersInParent",
    countKeys: { singular: "sharedFolderSingular", plural: "sharedFolderCount" },
    nestedKeys: { singular: "nestedSharedFolderSingular", plural: "nestedSharedFolderCount" },
  };
}

/**
 * The route a child shared folder's card links to: this vault, drilled into that folder. A folder's
 * route names the vault it lives in rather than the path taken through its ancestors, so drilling
 * deeper replaces the `:collectionId` segment rather than adding to it — see
 * {@link vaultScopeCommands}.
 */
function sharedFolderRoute(scope: VaultScope, folder: CollectionView): string[] {
  return vaultScopeCommands(
    scope.type === VaultScopeType.Organization ? { ...scope, collectionId: folder.id } : scope,
  );
}

function findNode(
  tree: TreeNode<CollectionView>[],
  id: string,
): TreeNode<CollectionView> | undefined {
  // Predates strict null checks: a miss comes back as `null` despite the signature.
  return ServiceUtils.getTreeNodeObjectFromList(tree, id) ?? undefined;
}
