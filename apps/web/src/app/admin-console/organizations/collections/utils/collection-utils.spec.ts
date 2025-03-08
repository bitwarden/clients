import { CollectionView } from "@bitwarden/admin-console/common";

import { getNestedCollectionTree } from "./collection-utils";

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
});
