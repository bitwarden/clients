import { CollectionView } from "@bitwarden/admin-console/common";
import { CollectionId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { getNestedCollectionTree, getFlatCollectionTree } from "./collection-utils";

describe("CollectionUtils Service", () => {
  describe("getNestedCollectionTree", () => {
    it("should return collections properly sorted if provided out of order", () => {
      // Arrange
      const collections: CollectionView[] = [];

      const parentCollection = new CollectionView({
        name: "Parent",
        organizationId: "orgId",
        id: null,
      });

      const childCollection = new CollectionView({
        name: "Parent/Child",
        organizationId: "orgId",
        id: null,
      });

      collections.push(childCollection);
      collections.push(parentCollection);

      // Act
      const result = getNestedCollectionTree(collections);

      // Assert
      expect(result[0].node.name).toBe("Parent");
      expect(result[0].children[0].node.name).toBe("Child");
    });

    it("should return an empty array if no collections are provided", () => {
      // Arrange
      const collections: CollectionView[] = [];

      // Act
      const result = getNestedCollectionTree(collections);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getFlatCollectionTree", () => {
    it("should flatten a tree node with no children", () => {
      // Arrange
      const collection = new CollectionView({
        name: "Test Collection",
        id: "test-id" as CollectionId,
        organizationId: "orgId",
      });

      const treeNodes: TreeNode<CollectionView>[] = [
        new TreeNode<CollectionView>(collection, {} as TreeNode<CollectionView>),
      ];

      // Act
      const result = getFlatCollectionTree(treeNodes);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0]).toBe(collection);
    });

    it("should flatten a tree node with children", () => {
      // Arrange
      const parentCollection = new CollectionView({
        name: "Parent",
        id: "parent-id" as CollectionId,
        organizationId: "orgId",
      });

      const child1Collection = new CollectionView({
        name: "Child 1",
        id: "child1-id" as CollectionId,
        organizationId: "orgId",
      });

      const child2Collection = new CollectionView({
        name: "Child 2",
        id: "child2-id" as CollectionId,
        organizationId: "orgId",
      });

      const grandchildCollection = new CollectionView({
        name: "Grandchild",
        id: "grandchild-id" as CollectionId,
        organizationId: "orgId",
      });

      const parentNode = new TreeNode<CollectionView>(
        parentCollection,
        {} as TreeNode<CollectionView>,
      );
      const child1Node = new TreeNode<CollectionView>(child1Collection, parentNode);
      const child2Node = new TreeNode<CollectionView>(child2Collection, parentNode);
      const grandchildNode = new TreeNode<CollectionView>(grandchildCollection, child1Node);

      parentNode.children = [child1Node, child2Node];
      child1Node.children = [grandchildNode];

      const treeNodes: TreeNode<CollectionView>[] = [parentNode];

      // Act
      const result = getFlatCollectionTree(treeNodes);

      // Assert
      expect(result.length).toBe(4);
      expect(result[0]).toBe(parentCollection);
      expect(result).toContain(child1Collection);
      expect(result).toContain(child2Collection);
      expect(result).toContain(grandchildCollection);
    });
  });
});
