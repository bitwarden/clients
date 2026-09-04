import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SharedFolderPermission } from "./shared-folder-permission";
import { sharedFolderRows } from "./shared-folder-rows";

const organizationId = "org-1" as OrganizationId;
const otherOrganizationId = "org-2" as OrganizationId;

type CollectionFlags = Partial<Pick<CollectionView, "readOnly" | "hidePasswords" | "manage">>;

const buildCollection = (
  id: string,
  flags: CollectionFlags = {},
  collectionOrganizationId: OrganizationId = organizationId,
): CollectionView =>
  Object.assign(
    new CollectionView({
      id: id as CollectionId,
      organizationId: collectionOrganizationId,
      name: id,
    }),
    flags,
  );

const buildDefaultCollection = (id: string): CollectionView =>
  Object.assign(buildCollection(id), { type: CollectionTypes.DefaultUserCollection });

const buildCipher = (
  id: string,
  collectionIds: string[],
  cipherOrganizationId: OrganizationId = organizationId,
): CipherView => {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.organizationId = cipherOrganizationId;
  cipher.collectionIds = collectionIds;
  return cipher;
};

const buildOrganization = (flags: Partial<Organization> = {}): Organization =>
  ({ id: organizationId, ...flags }) as Organization;

describe("sharedFolderRows", () => {
  it("lists only the given organization's collections", () => {
    const rows = sharedFolderRows({
      organizationId,
      organization: undefined,
      collections: [
        buildCollection("mine"),
        buildCollection("theirs", {}, otherOrganizationId),
        buildDefaultCollection("my-items"),
      ],
      ciphers: [],
    });

    expect(rows.map((row) => row.id)).toEqual(["mine"]);
  });

  it("carries the collection each row was built from", () => {
    const collection = buildCollection("folder");

    const [row] = sharedFolderRows({
      organizationId,
      organization: undefined,
      collections: [collection],
      ciphers: [],
    });

    expect(row).toEqual(
      expect.objectContaining({ id: "folder", organizationId, name: "folder", collection }),
    );
  });

  it.each([
    ["manage", { manage: true }, SharedFolderPermission.Manage],
    ["read-only", { readOnly: true }, SharedFolderPermission.View],
    [
      "read-only with hidden passwords",
      { readOnly: true, hidePasswords: true },
      SharedFolderPermission.ViewExceptPass,
    ],
    ["editable", {}, SharedFolderPermission.Edit],
    [
      "editable with hidden passwords",
      { hidePasswords: true },
      SharedFolderPermission.EditExceptPass,
    ],
  ])("resolves a %s collection's permission", (_label, flags: CollectionFlags, expected) => {
    const [row] = sharedFolderRows({
      organizationId,
      organization: undefined,
      collections: [buildCollection("folder", flags)],
      ciphers: [],
    });

    expect(row.permissions).toBe(expected);
  });

  it("resolves every permission to manage for a member who can edit all ciphers", () => {
    const [row] = sharedFolderRows({
      organizationId,
      organization: buildOrganization({ canEditAllCiphers: true }),
      collections: [buildCollection("folder", { readOnly: true, hidePasswords: true })],
      ciphers: [],
    });

    expect(row.permissions).toBe(SharedFolderPermission.Manage);
  });

  describe("what the member may do with a folder", () => {
    const permissionsOf = (
      flags: CollectionFlags,
      organization: Organization | undefined = undefined,
    ) => {
      const [row] = sharedFolderRows({
        organizationId,
        organization,
        collections: [buildCollection("folder", flags)],
        ciphers: [],
      });
      return { canEdit: row.canEdit, canDelete: row.canDelete };
    };

    it("lets a member who manages the folder edit and delete it", () => {
      expect(permissionsOf({ manage: true })).toEqual({ canEdit: true, canDelete: true });
    });

    it("lets a member who does not manage the folder do neither", () => {
      expect(permissionsOf({ manage: false })).toEqual({ canEdit: false, canDelete: false });
      expect(permissionsOf({ readOnly: true })).toEqual({ canEdit: false, canDelete: false });
    });

    // Deletion is the organization's to withhold; editing is not.
    it("withholds deletion while the organization limits it to its admins", () => {
      expect(
        permissionsOf(
          { manage: true },
          buildOrganization({ limitCollectionDeletion: true, isAdmin: false }),
        ),
      ).toEqual({ canEdit: true, canDelete: false });

      expect(
        permissionsOf(
          { manage: true },
          buildOrganization({ limitCollectionDeletion: true, isAdmin: true }),
        ),
      ).toEqual({ canEdit: true, canDelete: true });
    });
  });

  it("counts the folder's own active items", () => {
    const trashed = Object.assign(buildCipher("trashed", ["folder"]), {
      deletedDate: new Date(),
    });
    const archived = Object.assign(buildCipher("archived", ["folder"]), {
      archivedDate: new Date(),
    });

    const [row] = sharedFolderRows({
      organizationId,
      organization: undefined,
      collections: [buildCollection("folder")],
      ciphers: [
        buildCipher("in-folder", ["folder"]),
        buildCipher("also-in-folder", ["folder", "other"]),
        buildCipher("elsewhere", ["other"]),
        buildCipher("another-org", ["folder"], otherOrganizationId),
        trashed,
        archived,
      ],
    });

    expect(row.items).toBe(2);
  });

  it("counts each folder's own items when a cipher belongs to several", () => {
    const rows = sharedFolderRows({
      organizationId,
      organization: undefined,
      collections: [buildCollection("first"), buildCollection("second"), buildCollection("empty")],
      ciphers: [
        buildCipher("in-both", ["first", "second"]),
        buildCipher("in-second", ["second"]),
        buildCipher("uncollected", []),
      ],
    });

    expect(rows.map((row) => [row.id, row.items])).toEqual([
      ["first", 1],
      ["second", 2],
      ["empty", 0],
    ]);
  });
});
