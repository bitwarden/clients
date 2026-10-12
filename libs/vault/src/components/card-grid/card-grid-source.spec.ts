import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";

import { resolveCardGridSource } from "./card-grid-source";

const organizationId = "org-1" as OrganizationId;

function collection(id: string, name: string): CollectionView {
  return new CollectionView({ id: id as CollectionId, organizationId, name });
}

const sharedScope = (collectionId?: CollectionId): VaultScope => ({
  type: VaultScopeType.Organization,
  organizationId,
  collectionId,
});

describe("resolveCardGridSource", () => {
  describe("a shared folder", () => {
    const collections = [
      collection("eng", "Engineering"),
      collection("platform", "Engineering/Platform"),
      collection("api", "Engineering/Platform/API"),
    ];

    it("resolves the children of the folder in view with the shared folder copy", () => {
      const source = resolveCardGridSource(sharedScope("eng" as CollectionId), { collections });

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

    it("resolves nothing for a vault scope that names no folder", () => {
      expect(resolveCardGridSource(sharedScope(), { collections })).toBeUndefined();
    });

    it("resolves nothing for a folder the collections do not hold", () => {
      expect(
        resolveCardGridSource(sharedScope("missing" as CollectionId), { collections }),
      ).toBeUndefined();
    });
  });

  it.each([
    { type: VaultScopeType.AllItems },
    { type: VaultScopeType.MyVault },
    { type: VaultScopeType.Trash },
    { type: VaultScopeType.Archive },
    { type: VaultScopeType.Folder, folderId: "banking" },
  ] as VaultScope[])("resolves nothing for the %o scope", (scope) => {
    expect(
      resolveCardGridSource(scope, {
        collections: [collection("eng", "Engineering")],
      }),
    ).toBeUndefined();
  });
});
