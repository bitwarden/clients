import { CollectionView } from "@bitwarden/admin-console/common";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { getNestedCollectionTree, getFlatCollectionTree } from "./collection-utils";

describe("CollectionUtils Service", () => {
  describe("getNestedCollectionTree", () => {
    it("should return collections properly sorted if provided out of order", () => {
      // Arrange
      const collections: CollectionView[] = [];

      const parentCollection = new CollectionView();
      parentCollection.name = "Parent";

      const childCollection = new CollectionView();
      childCollection.name = "Parent/Child";

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
      const collection = new CollectionView();
      collection.name = "Test Collection";
      collection.id = "test-id";

      const treeNodes: TreeNode<CollectionView>[] = [
        new TreeNode<CollectionView>(collection, null),
      ];

      // Act
      const result = getFlatCollectionTree(treeNodes);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0]).toBe(collection);
    });

    it("should flatten a tree node with children", () => {
      // Arrange
      const parentCollection = new CollectionView();
      parentCollection.name = "Parent";
      parentCollection.id = "parent-id";

      const child1Collection = new CollectionView();
      child1Collection.name = "Child 1";
      child1Collection.id = "child1-id";

      const child2Collection = new CollectionView();
      child2Collection.name = "Child 2";
      child2Collection.id = "child2-id";

      const grandchildCollection = new CollectionView();
      grandchildCollection.name = "Grandchild";
      grandchildCollection.id = "grandchild-id";

      const parentNode = new TreeNode<CollectionView>(parentCollection, null);
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
