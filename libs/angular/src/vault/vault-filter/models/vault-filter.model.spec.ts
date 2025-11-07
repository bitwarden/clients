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

    describe("given a archived cipher", () => {
      const cipher = createCipher({ archivedDate: new Date() });

      it("should return true when filtering for archive", () => {
        const filterFunction = createFilterFunction({ status: "archive" });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filtering for favorites", () => {
        const filterFunction = createFilterFunction({ status: "favorites" });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filtering for trash", () => {
        const filterFunction = createFilterFunction({ status: "trash" });

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
      const cipher = createCipher({ folderId: undefined });

      it("should return true when filtering on unassigned folder", () => {
        const filterFunction = createFilterFunction({
          selectedFolder: true,
          selectedFolderId: undefined,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });
    });

    describe("given an organizational cipher (with organization and collections)", () => {
      const collection1 = "e9652fc0-1fe4-48d5-a3d8-d821e32fbd98";
      const collection2 = "42a971a5-8c16-48a3-a725-4be27cd99bc9";

      const cipher = createCipher({
        organizationId: "organizationId",
        collectionIds: [collection1, collection2],
      });

      it("should return true when filter matches collection id", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: collection1,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match collection id", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: "1ea7ad96-3fc1-4567-8fe5-91aa9f697fd1",
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
          selectedCollectionId: undefined,
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
      const cipher = createCipher({ organizationId: undefined, collectionIds: [] });

      it("should return false when filtering for unassigned collection", () => {
        const filterFunction = createFilterFunction({
          selectedCollection: true,
          selectedCollectionId: undefined,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return true when filtering for my vault only", () => {
        const cipher = createCipher({ organizationId: undefined });
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
  cipher.deletedDate = options.deletedDate ?? null;
  cipher.archivedDate = options.archivedDate ?? null;
  cipher.type = options.type ?? CipherType.Login;
  cipher.folderId = options.folderId ?? undefined;
  cipher.collectionIds = options.collectionIds ?? [];
  cipher.organizationId = options.organizationId ?? undefined;

  return cipher;
}
