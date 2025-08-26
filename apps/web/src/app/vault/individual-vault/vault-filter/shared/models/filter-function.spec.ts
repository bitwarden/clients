// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Unassigned } from "@bitwarden/admin-console/common";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { createFilterFunction } from "./filter-function";
import { All } from "./routed-vault-filter.model";

describe("createFilter", () => {
  describe("given a generic cipher", () => {
    it("should return true when no filter is applied", () => {
      const cipher = createCipher();
      const filterFunction = createFilterFunction({});

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });
  });

  describe("given a favorite cipher", () => {
    const cipher = createCipher({ favorite: true });

    it("should return true when filtering for favorites", () => {
      const filterFunction = createFilterFunction({ type: "favorites" });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return false when filtering for trash", () => {
      const filterFunction = createFilterFunction({ type: "trash" });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });
  });

  describe("given a deleted cipher", () => {
    const cipher = createCipher({ deletedDate: new Date() });

    it("should return true when filtering for trash", () => {
      const filterFunction = createFilterFunction({ type: "trash" });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return false when filtering for favorites", () => {
      const filterFunction = createFilterFunction({ type: "favorites" });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });

    it("should return false when type is not specified in filter", () => {
      const filterFunction = createFilterFunction({});

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });
  });

  describe("given a cipher with type", () => {
    it("should return true when filter matches cipher type", () => {
      const cipher = createCipher({ type: CipherType.Identity });
      const filterFunction = createFilterFunction({ type: "identity" });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return false when filter does not match cipher type", () => {
      const cipher = createCipher({ type: CipherType.Card });
      const filterFunction = createFilterFunction({ type: "favorites" });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });
  });

  describe("given a cipher with folder id", () => {
    it("should return true when filter matches folder id", () => {
      const cipher = createCipher({ folderId: "folderId" });
      const filterFunction = createFilterFunction({ folderId: "folderId" });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return false when filter does not match folder id", () => {
      const cipher = createCipher({ folderId: "folderId" });
      const filterFunction = createFilterFunction({ folderId: "differentFolderId" });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });
  });

  describe("given a cipher without folder", () => {
    const cipher = createCipher({ folderId: null });

    it("should return true when filtering on unassigned folder", () => {
      const filterFunction = createFilterFunction({ folderId: Unassigned });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });
  });

  describe("given an organizational cipher (with organization and collections)", () => {
    const cipher = createCipher({
      organizationId: "organizationId",
      collectionIds: ["collectionId", "anotherId"],
    });

    it("should return true when filter matches collection id", () => {
      const filterFunction = createFilterFunction({
        collectionId: "collectionId",
        organizationId: "organizationId",
      });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return false when filter does not match collection id", () => {
      const filterFunction = createFilterFunction({
        collectionId: "nonMatchingCollectionId",
        organizationId: "organizationId",
      });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });

    it("should return false when filter does not match organization id", () => {
      const filterFunction = createFilterFunction({
        organizationId: "nonMatchingOrganizationId",
      });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });

    it("should return false when filtering for my vault only", () => {
      const filterFunction = createFilterFunction({ organizationId: Unassigned });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });

    it("should return false when filtering by All Collections", () => {
      const filterFunction = createFilterFunction({ collectionId: All });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });
  });

  describe("given an unassigned organizational cipher (with organization, without collection)", () => {
    const cipher = createCipher({ organizationId: "organizationId", collectionIds: [] });

    it("should return true when filtering for unassigned collection", () => {
      const filterFunction = createFilterFunction({ collectionId: Unassigned });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });

    it("should return true when filter matches organization id", () => {
      const filterFunction = createFilterFunction({ organizationId: "organizationId" });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });
  });

  describe("given an individual cipher (without organization or collection)", () => {
    const cipher = createCipher({ organizationId: null, collectionIds: [] });

    it("should return false when filtering for unassigned collection", () => {
      const filterFunction = createFilterFunction({ collectionId: Unassigned });

      const result = filterFunction(cipher);

      expect(result).toBe(false);
    });

    it("should return true when filtering for my vault only", () => {
      const cipher = createCipher({ organizationId: null });
      const filterFunction = createFilterFunction({ organizationId: Unassigned });

      const result = filterFunction(cipher);

      expect(result).toBe(true);
    });
  });
});

function createCipher(options: Partial<CipherView> = {}) {
  const cipher = new CipherView();

  cipher.favorite = options.favorite ?? false;
  cipher.deletedDate = options.deletedDate;
  cipher.type = options.type ?? CipherType.Login;
  cipher.folderId = options.folderId;
  cipher.collectionIds = options.collectionIds;
  cipher.organizationId = options.organizationId;

  return cipher;
}
