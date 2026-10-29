import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils/collection-utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

/** A pinned shared folder as the side nav renders it, with the folders nested beneath it. */
export type PinnedFolderNode = {
  id: CollectionId;

  /** The folder's own name, without the path of the folders it is nested in. */
  name: string;

  children: PinnedFolderNode[];
};

export type ResolvePinnedFolderNodesParams = {
  organizationId: OrganizationId;

  /** Every collection the user holds; those of other organizations are ignored. */
  collections: CollectionView[];

  /** The pinned ids, which may name folders that no longer resolve or belong to other vaults. */
  pinnedIds: readonly CollectionId[];
};

/**
 * The organization's pinned shared folders, each with every folder nested beneath it.
 *
 * Pinned ids that name nothing the user can see in this organization are dropped from the result,
 * never from storage. A folder pinned alongside one of its ancestors appears twice: as its own
 * entry, and inside the ancestor's children. The organization's "My items" collection is left out.
 */
export function resolvePinnedFolderNodes({
  organizationId,
  collections,
  pinnedIds,
}: ResolvePinnedFolderNodesParams): PinnedFolderNode[] {
  const pinned = new Set<string>(pinnedIds);
  if (pinned.size === 0) {
    return [];
  }

  const shared = collections.filter(
    (collection) => collection.organizationId === organizationId && !collection.isDefaultCollection,
  );

  // Copied because the tree helper sorts the array it is handed.
  const tree = getNestedCollectionTree([...shared]);

  const pinnedNodes: PinnedFolderNode[] = [];
  const visit = (nodes: TreeNode<CollectionView>[]) => {
    for (const node of nodes) {
      if (pinned.has(node.node.id)) {
        pinnedNodes.push(toPinnedFolderNode(node));
      }
      visit(node.children);
    }
  };
  visit(tree);

  return sortByName(pinnedNodes);
}

function toPinnedFolderNode(node: TreeNode<CollectionView>): PinnedFolderNode {
  return {
    id: node.node.id,
    name: node.node.name,
    children: node.children.map(toPinnedFolderNode),
  };
}

function sortByName(nodes: PinnedFolderNode[]): PinnedFolderNode[] {
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
}
