import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { VaultFilter } from "./vault-filter.model";

describe("VaultFilter", () => {
  describe("filterFunction", () => {
    describe("generic cipher", () => {
      it("should return true when not filtering for anything specific", () => {
        const cipher = createCipher();
        const filterFunction = createFilterFunction({ status: "all" });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });
    });

    describe("given a favorite cipher", () => {
      const cipher = createCipher({ favorite: true });

      it("should return true when filtering for favorites", () => {
        const filterFunction = createFilterFunction({ status: "favorites" });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filtering for trash", () => {
        const filterFunction = createFilterFunction({ status: "trash" });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a deleted cipher", () => {
      const cipher = createCipher({ deletedDate: new Date() });

      it("should return true when filtering for trash", () => {
        const filterFunction = createFilterFunction({ status: "trash" });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filtering for favorites", () => {
        const filterFunction = createFilterFunction({ status: "favorites" });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher with type", () => {
      it("should return true when filter matches cipher type", () => {
        const cipher = createCipher({ type: CipherType.Identity });
        const filterFunction = createFilterFunction({ cipherType: CipherType.Identity });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match cipher type", () => {
        const cipher = createCipher({ type: CipherType.Card });
        const filterFunction = createFilterFunction({ cipherType: CipherType.Identity });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher with folder id", () => {
      it("should return true when filter matches folder id", () => {
        const cipher = createCipher({ folderId: "folderId" });
        const filterFunction = createFilterFunction({
          selectedFolder: true,
          selectedFolderId: "folderId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match folder id", () => {
        const cipher = createCipher({ folderId: "folderId" });
        const filterFunction = createFilterFunction({
          selectedFolder: true,
          selectedFolderId: "anotherFolderId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher without folder", () => {
      const cipher = createCipher({ folderId: null });

      it("should return true when filtering on unassigned folder", () => {
        const filterFunction = createFilterFunction({
          selectedFolder: true,
          selectedFolderId: null,
        });

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
          selectedCollection: true,
          selectedCollectionId: "collectionId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match collection id", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: "nonMatchingId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filter does not match organization id", () => {
        const filterFunction = createFilterFunction({
          selectedOrganizationId: "anotherOrganizationId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filtering for my vault only", () => {
        const filterFunction = createFilterFunction({
          myVaultOnly: true,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given an unassigned organizational cipher (with organization, without collection)", () => {
      const cipher = createCipher({ organizationId: "organizationId", collectionIds: [] });

      it("should return true when filtering for unassigned collection", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: null,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return true when filter matches organization id", () => {
        const filterFunction = createFilterFunction({
          selectedOrganizationId: "organizationId",
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });
    });

    describe("given an individual cipher (without organization or collection)", () => {
      const cipher = createCipher({ organizationId: null, collectionIds: [] });

      it("should return false when filtering for unassigned collection", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: null,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return true when filtering for my vault only", () => {
        const cipher = createCipher({ organizationId: null });
        const filterFunction = createFilterFunction({
          myVaultOnly: true,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });
    });
  });
});

function createFilterFunction(options: Partial<VaultFilter> = {}) {
  return new VaultFilter(options).buildFilter();
}

function createCipher(options: Partial<CipherView> = {}) {
  const cipher = new CipherView();

  cipher.favorite = options.favorite ?? false;
  cipher.deletedDate = options.deletedDate;
  cipher.type = options.type;
  cipher.folderId = options.folderId;
  cipher.collectionIds = options.collectionIds;
  cipher.organizationId = options.organizationId;

  return cipher;
}
