import { OrganizationId } from "../../types/guid";
import { TreeNode } from "../../vault/models/domain/tree-node";
import { ServiceUtils } from "../../vault/service-utils";
import { CollectionView, NestingDelimiter, CollectionAdminView } from "../models/collections";

export function getNestedCollectionTree<T extends CollectionView | CollectionAdminView>(
  collections: T[],
): TreeNode<T>[] {
  if (!collections) {
    return [];
  }

  // Collections need to be cloned because ServiceUtils.nestedTraverse actively
  // modifies the names of collections.
  // These changes risk affecting collections store in StateService.
  const clonedCollections = collections
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cloneCollection);

  const all: TreeNode<T>[] = [];
  const groupedByOrg = new Map<OrganizationId, T[]>();
  clonedCollections.map((c) => {
    const key = c.organizationId;
    (groupedByOrg.get(key) ?? groupedByOrg.set(key, []).get(key)!).push(c);
  });
  for (const group of groupedByOrg.values()) {
    const nodes: TreeNode<T>[] = [];
    for (const c of group) {
      const parts = c.name ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, c, undefined, NestingDelimiter);
    }
    all.push(...nodes);
  }
  return all;
}

export function cloneCollection<T extends CollectionView | CollectionAdminView>(collection: T): T {
  const base =
    collection instanceof CollectionAdminView
      ? new CollectionAdminView({ ...collection, name: collection.name })
      : new CollectionView({ ...collection, name: collection.name });
  return Object.assign(base, collection) as T;
}

export function getFlatCollectionTree<T extends CollectionView | CollectionAdminView>(
  nodes: TreeNode<T>[],
): T[] {
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
