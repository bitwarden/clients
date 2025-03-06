import { CollectionView } from "@bitwarden/admin-console/common";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { getNestedCollectionTree } from "./collection-utils";

describe("CollectionUtils Service", () => {
  describe("getNestedCollectionTree", () => {
    it("should be performant", () => {
      // This is a temporary test just to illustrate performance difference.
      // Without changes: 3841ms
      // With changes: 121ms

      const collections = Array(25000)
        .fill(null)
        .map(() => {
          const coll = new CollectionView();
          coll.name = Utils.newGuid();
          return coll;
        });

      const result = getNestedCollectionTree(collections);

      expect(result.length).toBe(25000);
    });

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
