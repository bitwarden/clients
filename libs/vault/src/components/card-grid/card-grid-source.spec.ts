import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";

import { resolveCardGridSource } from "./card-grid-source";

const organizationId = "org-1" as OrganizationId;

function collection(id: string, name: string): CollectionView {
  return new CollectionView({ id: id as CollectionId, organizationId, name });
}

function folder(id: string, name: string): FolderView {
  return Object.assign(new FolderView(), { id, name });
}

const sharedScope = (collectionId?: CollectionId): VaultScope => ({
  type: VaultScopeType.Organization,
  organizationId,
  collectionId,
});

const folderScope = (folderId: string): VaultScope => ({ type: VaultScopeType.Folder, folderId });

describe("resolveCardGridSource", () => {
  describe("a shared folder", () => {
    const collections = [
      collection("eng", "Engineering"),
      collection("platform", "Engineering/Platform"),
      collection("api", "Engineering/Platform/API"),
    ];

    it("resolves the children of the folder in view with the shared folder copy", () => {
      const source = resolveCardGridSource(sharedScope("eng" as CollectionId), {
        collections,
        folders: [],
      });

      expect(source).toEqual({
        parentName: "Engineering",
        cards: [
          {
            id: "platform",
            name: "Platform",
            commands: ["/vault", "org-1", "shared-folders", "platform"],
            icon: "bwi-shared-folder",
            nestedCount: 1,
          },
        ],
        titleKey: "sharedFoldersInParent",
        countKeys: { singular: "sharedFolderSingular", plural: "sharedFolderCount" },
        nestedKeys: { singular: "nestedSharedFolderSingular", plural: "nestedSharedFolderCount" },
      });
    });

    it("ignores the user's folders", () => {
      const source = resolveCardGridSource(sharedScope("eng" as CollectionId), {
        collections,
        folders: [folder("banking", "Banking"), folder("checking", "Banking/Checking")],
      });

      expect(source?.cards.map((card) => card.id)).toEqual(["platform"]);
    });

    it("resolves nothing for a vault scope that names no folder", () => {
      expect(resolveCardGridSource(sharedScope(), { collections, folders: [] })).toBeUndefined();
    });

    it("resolves nothing for a folder the collections do not hold", () => {
      expect(
        resolveCardGridSource(sharedScope("missing" as CollectionId), { collections, folders: [] }),
      ).toBeUndefined();
    });
  });

  describe("a My folder", () => {
    const folders = [
      folder("banking", "Banking"),
      folder("savings", "Banking/Savings"),
      folder("checking", "Banking/Checking"),
      folder("cards", "Banking/Savings/Cards"),
    ];

    it("resolves the children of the folder in view with the My folders copy", () => {
      const source = resolveCardGridSource(folderScope("banking"), { collections: [], folders });

      expect(source).toEqual({
        parentName: "Banking",
        cards: [
          {
            id: "checking",
            name: "Checking",
            commands: ["/folders", "checking"],
            icon: "bwi-folder",
            nestedCount: 0,
          },
          {
            id: "savings",
            name: "Savings",
            commands: ["/folders", "savings"],
            icon: "bwi-folder",
            nestedCount: 1,
          },
        ],
        titleKey: "foldersInParent",
        countKeys: { singular: "folderSingular", plural: "folderCount" },
        nestedKeys: { singular: "nestedFolderSingular", plural: "nestedFolderCount" },
      });
    });

    it("ignores the collections", () => {
      const source = resolveCardGridSource(folderScope("banking"), {
        collections: [
          collection("eng", "Engineering"),
          collection("platform", "Engineering/Platform"),
        ],
        folders,
      });

      expect(source?.cards.map((card) => card.id)).toEqual(["checking", "savings"]);
    });

    it("names a child whose intermediate parent is missing by its own name", () => {
      const source = resolveCardGridSource(folderScope("banking"), {
        collections: [],
        folders: [folder("banking", "Banking"), folder("deep", "Banking/Next/Deeper")],
      });

      expect(source?.cards.map((card) => card.name)).toEqual(["Deeper"]);
    });

    it("leaves out unnamed folders", () => {
      const source = resolveCardGridSource(folderScope("banking"), {
        collections: [],
        folders: [...folders, folder("unnamed", "")],
      });

      expect(source?.cards.map((card) => card.id)).toEqual(["checking", "savings"]);
    });

    it("resolves nothing for a folder the folders do not hold", () => {
      expect(
        resolveCardGridSource(folderScope("missing"), { collections: [], folders }),
      ).toBeUndefined();
    });
  });

  it.each([
    { type: VaultScopeType.AllItems },
    { type: VaultScopeType.MyVault },
    { type: VaultScopeType.Trash },
    { type: VaultScopeType.Archive },
  ] as VaultScope[])("resolves nothing for the %o scope", (scope) => {
    expect(
      resolveCardGridSource(scope, {
        collections: [collection("eng", "Engineering")],
        folders: [folder("banking", "Banking")],
      }),
    ).toBeUndefined();
  });
});
