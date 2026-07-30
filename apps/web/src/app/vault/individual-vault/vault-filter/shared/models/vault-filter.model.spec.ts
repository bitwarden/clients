// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { VaultFilter } from "./vault-filter.model";
import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "./vault-filter.type";

describe("VaultFilter", () => {
  describe("filterFunction", () => {
    const allCiphersFilter = new TreeNode<CipherTypeFilter>(
      {
        id: "AllItems",
        name: "allItems",
        type: "all",
        icon: "",
      },
      null,
    );
    const favoriteCiphersFilter = new TreeNode<CipherTypeFilter>(
      {
        id: "favorites",
        name: "favorites",
        type: "favorites",
        icon: "bwi-star",
      },
      null,
    );
    const identityCiphersFilter = new TreeNode<CipherTypeFilter>(
      {
        id: "identity",
        name: "identity",
        type: CipherType.Identity,
        icon: "bwi-id-card",
      },
      null,
    );
    const trashFilter = new TreeNode<CipherTypeFilter>(
      {
        id: "trash",
        name: "trash",
        type: "trash",
        icon: "bwi-trash",
      },
      null,
    );
    describe("generic cipher", () => {
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
        const filterFunction = createFilterFunction({ selectedCipherTypeNode: allCiphersFilter });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filtering for trash", () => {
        const filterFunction = createFilterFunction({ selectedCipherTypeNode: trashFilter });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a deleted cipher", () => {
      const cipher = createCipher({ deletedDate: new Date() });

      it("should return true when filtering for trash", () => {
        const filterFunction = createFilterFunction({ selectedCipherTypeNode: trashFilter });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filtering for favorites", () => {
        const filterFunction = createFilterFunction({
          selectedCipherTypeNode: favoriteCiphersFilter,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher with type", () => {
      it("should return true when filter matches cipher type", () => {
        const cipher = createCipher({ type: CipherType.Identity });
        const filterFunction = createFilterFunction({
          selectedCipherTypeNode: identityCiphersFilter,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match cipher type", () => {
        const cipher = createCipher({ type: CipherType.Card });
        const filterFunction = createFilterFunction({
          selectedCipherTypeNode: identityCiphersFilter,
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher with folder id", () => {
      it("should return true when filter matches folder id", () => {
        const cipher = createCipher({ folderId: "folderId" });
        const filterFunction = createFilterFunction({
          selectedFolderNode: createFolderFilterNode({ id: "folderId" }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match folder id", () => {
        const cipher = createCipher({ folderId: "folderId" });
        const filterFunction = createFilterFunction({
          selectedFolderNode: createFolderFilterNode({ id: "differentFolderId" }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given a cipher without folder", () => {
      const cipher = createCipher({ folderId: null });

      it("should return true when filtering on unassigned folder", () => {
        const filterFunction = createFilterFunction({
          selectedFolderNode: createFolderFilterNode({ id: null }),
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
          selectedCollectionNode: createCollectionFilterNode({
            id: "collectionId",
            organizationId: "organizationId",
          }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return false when filter does not match collection id", () => {
        const filterFunction = createFilterFunction({
          selectedCollectionNode: createCollectionFilterNode({
            id: "nonMatchingCollectionId",
            organizationId: "organizationId",
          }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filter does not match organization id", () => {
        const filterFunction = createFilterFunction({
          selectedOrganizationNode: createOrganizationFilterNode({
            id: "nonMatchingOrganizationId",
          }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filtering for my vault only", () => {
        const filterFunction = createFilterFunction({
          selectedOrganizationNode: createOrganizationFilterNode({ id: "MyVault" }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return false when filtering by All Collections", () => {
        const filterFunction = createFilterFunction({
          selectedCollectionNode: createCollectionFilterNode({
            id: "AllCollections" as CollectionId,
          }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });
    });

    describe("given an unassigned organizational cipher (with organization, without collection)", () => {
      const cipher = createCipher({ organizationId: "organizationId", collectionIds: [] });

      it("should return true when filtering for unassigned collection", () => {
        const filterFunction = createFilterFunction({
          selectedCollectionNode: createCollectionFilterNode({ id: null }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });

      it("should return true when filter matches organization id", () => {
        const filterFunction = createFilterFunction({
          selectedOrganizationNode: createOrganizationFilterNode({ id: "organizationId" }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(true);
      });
    });

    describe("given an individual cipher (without organization or collection)", () => {
      const cipher = createCipher({ organizationId: null, collectionIds: [] });

      it("should return false when filtering for unassigned collection", () => {
        const filterFunction = createFilterFunction({
          selectedCollectionNode: createCollectionFilterNode({ id: null }),
        });

        const result = filterFunction(cipher);

        expect(result).toBe(false);
      });

      it("should return true when filtering for my vault only", () => {
        const cipher = createCipher({ organizationId: null });
        const filterFunction = createFilterFunction({
          selectedOrganizationNode: createOrganizationFilterNode({ id: "MyVault" }),
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

function createOrganizationFilterNode(
  options: Partial<OrganizationFilter>,
): TreeNode<OrganizationFilter> {
  const org = new Organization() as OrganizationFilter;
  org.id = options.id;
  org.icon = options.icon ?? "";
  return new TreeNode<OrganizationFilter>(org, null);
}

function createFolderFilterNode(options: Partial<FolderFilter>): TreeNode<FolderFilter> {
  const folder = new FolderView() as FolderFilter;
  folder.id = options.id;
  folder.name = options.name;
  folder.icon = options.icon ?? "";
  folder.revisionDate = options.revisionDate ?? new Date();
  return new TreeNode<FolderFilter>(folder, null);
}

function createCollectionFilterNode(
  options: Partial<CollectionFilter>,
): TreeNode<CollectionFilter> {
  const collection = new CollectionView({
    name: options.name ?? "Test Name",
    id: options.id ?? null,
    organizationId: options.organizationId ?? "Org Id",
  }) as CollectionFilter;
  return new TreeNode<CollectionFilter>(collection, {} as TreeNode<CollectionFilter>);
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
