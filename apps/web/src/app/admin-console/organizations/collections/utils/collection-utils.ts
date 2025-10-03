// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  CollectionAdminView,
  CollectionView,
  NestingDelimiter,
} from "@bitwarden/admin-console/common";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";

export function getNestedCollectionTree(
  collections: CollectionAdminView[],
): TreeNode<CollectionAdminView>[];
export function getNestedCollectionTree(collections: CollectionView[]): TreeNode<CollectionView>[];
export function getNestedCollectionTree(
  collections: (CollectionView | CollectionAdminView)[],
): TreeNode<CollectionView | CollectionAdminView>[] {
  if (!collections) {
    return [];
  }

  // Collections need to be cloned because ServiceUtils.nestedTraverse actively
  // modifies the names of collections.
  // These changes risk affecting collections store in StateService.
  const clonedCollections: CollectionView[] | CollectionAdminView[] = collections
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cloneCollection);

  const all: TreeNode<CollectionView | CollectionAdminView>[] = [];
  const groupedByOrg = new Map<OrganizationId, CollectionView[]>();
  clonedCollections.map((c) => {
    const key = c.organizationId;
    (groupedByOrg.get(key) ?? groupedByOrg.set(key, []).get(key)!).push(c);
  });

  for (const group of groupedByOrg.values()) {
    const nodes: TreeNode<CollectionView>[] = [];
    for (const c of group) {
      const collectionCopy = Object.assign(new CollectionView({ ...c, name: c.name }), c);
      const parts = c.name ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, collectionCopy, undefined, NestingDelimiter);
    }
    all.push(...nodes);
  }
  return all;
}

export function cloneCollection(collection: CollectionView): CollectionView;
export function cloneCollection(collection: CollectionAdminView): CollectionAdminView;
export function cloneCollection(
  collection: CollectionView | CollectionAdminView,
): CollectionView | CollectionAdminView {
  let cloned;

  if (collection instanceof CollectionAdminView) {
    cloned = Object.assign(
      new CollectionAdminView({ ...collection, name: collection.name }),
      collection,
    );
  } else {
    cloned = Object.assign(
      new CollectionView({ ...collection, name: collection.name }),
      collection,
    );
  }
  return cloned;
}

export function getFlatCollectionTree(
  nodes: TreeNode<CollectionAdminView>[],
): CollectionAdminView[];
export function getFlatCollectionTree(nodes: TreeNode<CollectionView>[]): CollectionView[];
export function getFlatCollectionTree(
  nodes: TreeNode<CollectionView | CollectionAdminView>[],
): (CollectionView | CollectionAdminView)[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (!node.children || node.children.length === 0) {
      return [node.node];
    }

    const children = getFlatCollectionTree(node.children);
    return [node.node, ...children];
  });
}
