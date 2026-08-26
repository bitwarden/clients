import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "./vault-nav-view-model";
import {
  ALL_ITEMS_SCOPE,
  ARCHIVE_ROUTE,
  cipherInScope,
  collectionInScope,
  defaultUserCollectionId,
  isPersonalOnly,
  MY_ITEMS_ROUTE,
  MY_VAULT_ROUTE,
  organizationInScope,
  parseVaultScope,
  resolveVaultScope,
  scopedSharedFolderId,
  TRASH_ROUTE,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "./vault-scope";

const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;
const collectionId = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f" as CollectionId;
const myItemsCollectionId = "5e6f7a8b-9c1d-4e2f-8a3b-4c5d6e7f8a9b" as CollectionId;

const myVaultScope: VaultScope = { type: VaultScopeType.MyVault };
const organizationScope: VaultScope = { type: VaultScopeType.Organization, organizationId };
const sharedFolderScope: VaultScope = {
  type: VaultScopeType.Organization,
  organizationId,
  collectionId,
};
const myItemsScope: VaultScope = {
  type: VaultScopeType.Organization,
  organizationId,
  collectionId: MY_ITEMS_ROUTE,
};
const trashScope: VaultScope = { type: VaultScopeType.Trash };
const archiveScope: VaultScope = { type: VaultScopeType.Archive };

const buildCipher = (cipherOrganizationId?: string, collectionIds: string[] = []) => {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.organizationId = cipherOrganizationId ?? null;
  cipher.collectionIds = collectionIds;
  return cipher;
};

const trashed = (cipher: CipherView) => Object.assign(cipher, { deletedDate: new Date() });
const archived = (cipher: CipherView) => Object.assign(cipher, { archivedDate: new Date() });

const buildCollection = (collectionOrganizationId: string) => {
  const collection = new CollectionView({
    id: "collection-1" as CollectionId,
    organizationId: collectionOrganizationId as OrganizationId,
    name: "Collection",
  });
  return collection;
};

const buildOrganization = (id: string) => ({ id }) as Organization;

const buildNavItem = (
  id: string,
  type: VaultNavItemType,
  navDefaultUserCollectionId?: CollectionId,
): VaultNavItemViewModel => ({
  id,
  label: id,
  color: "purple",
  icon: "bwi-user",
  type,
  defaultUserCollectionId: navDefaultUserCollectionId,
});

const buildNav = (
  vaults: VaultNavItemViewModel[],
  organizationDataOwnership = false,
): VaultsNavViewModel => ({ vaults, organizationDataOwnership });

const personalNav = buildNav([buildNavItem("user-1", VaultNavItemType.Personal)]);

/** An account under data ownership: one organization vault, with a "My items" collection. */
const dataOwnershipNav = buildNav(
  [buildNavItem(organizationId, VaultNavItemType.Organization, myItemsCollectionId)],
  true,
);

describe("parseVaultScope", () => {
  it("reads an absent segment as All items", () => {
    expect(parseVaultScope(undefined)).toEqual(ALL_ITEMS_SCOPE);
    expect(parseVaultScope(null)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("reads the my-vault segment as the personal vault", () => {
    expect(parseVaultScope(MY_VAULT_ROUTE)).toEqual(myVaultScope);
  });

  it("reads the trash and archive segments as their own scopes", () => {
    expect(parseVaultScope(TRASH_ROUTE)).toEqual(trashScope);
    expect(parseVaultScope(ARCHIVE_ROUTE)).toEqual(archiveScope);
  });

  it("reads a guid as an organization vault", () => {
    expect(parseVaultScope(organizationId)).toEqual(organizationScope);
  });

  it("rejects a segment that names no vault", () => {
    expect(parseVaultScope("acme-corp")).toBeNull();
    expect(parseVaultScope("myVault")).toBeNull();
    expect(parseVaultScope("")).toBeNull();
  });

  // "My items" is a collection within an organization vault, never a vault of its own.
  it("rejects the my-items segment as a vault", () => {
    expect(parseVaultScope(MY_ITEMS_ROUTE)).toBeNull();
  });

  describe("collection segment", () => {
    it("drills an organization vault into the shared folder it names", () => {
      expect(parseVaultScope(organizationId, collectionId)).toEqual(sharedFolderScope);
    });

    it("reads an absent collection segment as the whole vault", () => {
      expect(parseVaultScope(organizationId, null)).toEqual(organizationScope);
      expect(parseVaultScope(organizationId, undefined)).toEqual(organizationScope);
    });

    // A shared folder belongs to an organization, so no other scope can hold one.
    it("rejects a collection alongside any other vault", () => {
      expect(parseVaultScope(undefined, collectionId)).toBeNull();
      expect(parseVaultScope(MY_VAULT_ROUTE, collectionId)).toBeNull();
      expect(parseVaultScope(TRASH_ROUTE, collectionId)).toBeNull();
      expect(parseVaultScope(ARCHIVE_ROUTE, collectionId)).toBeNull();
    });

    it("rejects a collection segment that is no guid", () => {
      expect(parseVaultScope(organizationId, "engineering")).toBeNull();
      expect(parseVaultScope(organizationId, "")).toBeNull();
    });

    // The id behind it differs per member, so the URL carries the sentinel until the nav resolves
    // it — see resolveVaultScope.
    it("keeps the my-items sentinel for an organization vault", () => {
      expect(parseVaultScope(organizationId, MY_ITEMS_ROUTE)).toEqual(myItemsScope);
    });

    it("rejects the my-items sentinel alongside any other vault", () => {
      expect(parseVaultScope(undefined, MY_ITEMS_ROUTE)).toBeNull();
      expect(parseVaultScope(MY_VAULT_ROUTE, MY_ITEMS_ROUTE)).toBeNull();
      expect(parseVaultScope(TRASH_ROUTE, MY_ITEMS_ROUTE)).toBeNull();
      expect(parseVaultScope(ARCHIVE_ROUTE, MY_ITEMS_ROUTE)).toBeNull();
    });

    it("rejects a collection under a vault it has already rejected", () => {
      expect(parseVaultScope("acme-corp", collectionId)).toBeNull();
    });
  });
});

describe("isPersonalOnly", () => {
  it("is true for an account whose only vault is personal", () => {
    expect(isPersonalOnly(personalNav)).toBe(true);
  });

  it("is false once the account has a second vault", () => {
    const nav = buildNav([
      buildNavItem("user-1", VaultNavItemType.Personal),
      buildNavItem(organizationId, VaultNavItemType.Organization),
    ]);

    expect(isPersonalOnly(nav)).toBe(false);
  });

  // The lone vault is an organization's, and personal items may still exist outside it.
  it("is false when data ownership leaves one organization vault", () => {
    const nav = buildNav([buildNavItem(organizationId, VaultNavItemType.Organization)], true);

    expect(isPersonalOnly(nav)).toBe(false);
  });
});

describe("resolveVaultScope", () => {
  it("resolves All items to the personal vault for a personal-only account", () => {
    expect(resolveVaultScope(undefined, null, personalNav)).toEqual(myVaultScope);
  });

  it("leaves All items alone for an account with more than one vault", () => {
    const nav = buildNav([
      buildNavItem("user-1", VaultNavItemType.Personal),
      buildNavItem(organizationId, VaultNavItemType.Organization),
    ]);

    expect(resolveVaultScope(undefined, null, nav)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("leaves All items alone until the account's vaults load", () => {
    expect(resolveVaultScope(undefined, null, undefined)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("passes every other segment through untouched", () => {
    expect(resolveVaultScope(TRASH_ROUTE, null, personalNav)).toEqual(trashScope);
    expect(resolveVaultScope(ARCHIVE_ROUTE, null, personalNav)).toEqual(archiveScope);
    expect(resolveVaultScope(organizationId, null, personalNav)).toEqual(organizationScope);
    expect(resolveVaultScope("acme-corp", null, personalNav)).toBeNull();
  });

  it("keeps the shared folder a drilled-in segment names", () => {
    expect(resolveVaultScope(organizationId, collectionId, personalNav)).toEqual(sharedFolderScope);
  });

  describe("the my-items segment", () => {
    it("resolves to the organization's My items collection", () => {
      expect(resolveVaultScope(organizationId, MY_ITEMS_ROUTE, dataOwnershipNav)).toEqual({
        type: VaultScopeType.Organization,
        organizationId,
        collectionId: myItemsCollectionId,
      });
    });

    // Widening to the whole organization vault meanwhile would show items the URL did not ask for.
    it("stays unresolved until the account's vaults load", () => {
      expect(resolveVaultScope(organizationId, MY_ITEMS_ROUTE, undefined)).toEqual(myItemsScope);
    });

    it("names no destination for an organization without a My items collection", () => {
      const nav = buildNav([
        buildNavItem("user-1", VaultNavItemType.Personal),
        buildNavItem(organizationId, VaultNavItemType.Organization),
      ]);

      expect(resolveVaultScope(organizationId, MY_ITEMS_ROUTE, nav)).toBeNull();
    });

    it("names no destination for an organization the account has no vault for", () => {
      expect(resolveVaultScope(otherOrganizationId, MY_ITEMS_ROUTE, dataOwnershipNav)).toBeNull();
    });
  });
});

describe("defaultUserCollectionId", () => {
  it("names the organization's My items collection", () => {
    expect(defaultUserCollectionId(organizationId, dataOwnershipNav)).toBe(myItemsCollectionId);
  });

  it("names none for an organization that has no such collection", () => {
    const nav = buildNav([buildNavItem(organizationId, VaultNavItemType.Organization)]);

    expect(defaultUserCollectionId(organizationId, nav)).toBeUndefined();
  });

  it("names none for an organization the account has no vault for", () => {
    expect(defaultUserCollectionId(otherOrganizationId, dataOwnershipNav)).toBeUndefined();
  });

  it("names none until the account's vaults load", () => {
    expect(defaultUserCollectionId(organizationId, undefined)).toBeUndefined();
  });

  // The personal vault's id is the user's, which no organization can collide with — but the check
  // costs nothing and keeps the two id spaces from being conflated.
  it("does not mistake the personal vault for an organization", () => {
    const nav = buildNav([
      buildNavItem(organizationId, VaultNavItemType.Personal, myItemsCollectionId),
    ]);

    expect(defaultUserCollectionId(organizationId, nav)).toBeUndefined();
  });
});

describe("vaultScopeCommands", () => {
  it.each([
    [ALL_ITEMS_SCOPE, ["/vault"]],
    [myVaultScope, ["/vault", MY_VAULT_ROUTE]],
    [organizationScope, ["/vault", organizationId]],
    [trashScope, ["/vault", TRASH_ROUTE]],
    [archiveScope, ["/vault", ARCHIVE_ROUTE]],
    [sharedFolderScope, ["/vault", organizationId, collectionId]],
    [myItemsScope, ["/vault", organizationId, MY_ITEMS_ROUTE]],
  ])("builds the route for %p", (scope: VaultScope, expected: string[]) => {
    expect(vaultScopeCommands(scope)).toEqual(expected);
  });

  it("round-trips through parseVaultScope", () => {
    for (const scope of [
      ALL_ITEMS_SCOPE,
      myVaultScope,
      organizationScope,
      trashScope,
      archiveScope,
      sharedFolderScope,
      myItemsScope,
    ]) {
      const [, segment, collectionSegment] = vaultScopeCommands(scope);
      expect(parseVaultScope(segment, collectionSegment)).toEqual(scope);
    }
  });
});

describe("scopedSharedFolderId", () => {
  it("names the folder an organization vault has drilled into", () => {
    expect(scopedSharedFolderId(sharedFolderScope)).toBe(collectionId);
  });

  it("names an unresolved My items drill-in by its sentinel", () => {
    expect(scopedSharedFolderId(myItemsScope)).toBe(MY_ITEMS_ROUTE);
  });

  it.each([
    ["All items", ALL_ITEMS_SCOPE],
    ["the personal vault", myVaultScope],
    ["a whole organization vault", organizationScope],
    ["trash", trashScope],
    ["the archive", archiveScope],
  ])("names no folder for %s", (_name, scope: VaultScope) => {
    expect(scopedSharedFolderId(scope)).toBeUndefined();
  });
});

describe("cipherInScope", () => {
  it("keeps every active cipher for All items", () => {
    expect(cipherInScope(buildCipher(), ALL_ITEMS_SCOPE)).toBe(true);
    expect(cipherInScope(buildCipher(organizationId), ALL_ITEMS_SCOPE)).toBe(true);
  });

  it("keeps only individually owned ciphers for the personal vault", () => {
    expect(cipherInScope(buildCipher(), myVaultScope)).toBe(true);
    expect(cipherInScope(buildCipher(organizationId), myVaultScope)).toBe(false);
  });

  it("keeps only the organization's ciphers for an organization vault", () => {
    expect(cipherInScope(buildCipher(organizationId), organizationScope)).toBe(true);
    expect(cipherInScope(buildCipher(otherOrganizationId), organizationScope)).toBe(false);
    expect(cipherInScope(buildCipher(), organizationScope)).toBe(false);
  });

  describe("a vault drilled into a shared folder", () => {
    it("keeps the folder's own ciphers", () => {
      expect(cipherInScope(buildCipher(organizationId, [collectionId]), sharedFolderScope)).toBe(
        true,
      );
    });

    it("keeps a cipher that belongs to the folder among others", () => {
      const cipher = buildCipher(organizationId, ["other-collection", collectionId]);

      expect(cipherInScope(cipher, sharedFolderScope)).toBe(true);
    });

    // A child folder's items arrive with the drill-in to the child.
    it("drops ciphers in the organization but outside the folder", () => {
      expect(
        cipherInScope(buildCipher(organizationId, ["other-collection"]), sharedFolderScope),
      ).toBe(false);
      expect(cipherInScope(buildCipher(organizationId), sharedFolderScope)).toBe(false);
    });

    it("drops ciphers from another organization that names the same folder", () => {
      const cipher = buildCipher(otherOrganizationId, [collectionId]);

      expect(cipherInScope(cipher, sharedFolderScope)).toBe(false);
    });

    // The sentinel is no collection id, so it matches none — resolveVaultScope trades it for the
    // id before the page narrows by it.
    it("keeps no ciphers for a My items drill-in that is still unresolved", () => {
      expect(cipherInScope(buildCipher(organizationId, [myItemsCollectionId]), myItemsScope)).toBe(
        false,
      );
    });

    it("drops the folder's trashed and archived ciphers", () => {
      expect(
        cipherInScope(trashed(buildCipher(organizationId, [collectionId])), sharedFolderScope),
      ).toBe(false);
      expect(
        cipherInScope(archived(buildCipher(organizationId, [collectionId])), sharedFolderScope),
      ).toBe(false);
    });
  });

  it.each([
    ["All items", ALL_ITEMS_SCOPE],
    ["the personal vault", myVaultScope],
    ["an organization vault", organizationScope],
  ])("drops trashed and archived ciphers from %s", (_name, scope: VaultScope) => {
    expect(cipherInScope(trashed(buildCipher(organizationId)), scope)).toBe(false);
    expect(cipherInScope(archived(buildCipher(organizationId)), scope)).toBe(false);
    expect(cipherInScope(trashed(buildCipher()), scope)).toBe(false);
    expect(cipherInScope(archived(buildCipher()), scope)).toBe(false);
  });

  describe("trash", () => {
    it("keeps trashed ciphers from every vault", () => {
      expect(cipherInScope(trashed(buildCipher()), trashScope)).toBe(true);
      expect(cipherInScope(trashed(buildCipher(organizationId)), trashScope)).toBe(true);
      expect(cipherInScope(trashed(buildCipher(otherOrganizationId)), trashScope)).toBe(true);
    });

    it("keeps a trashed cipher that was archived before it was deleted", () => {
      expect(cipherInScope(trashed(archived(buildCipher())), trashScope)).toBe(true);
    });

    it("drops active and archived ciphers", () => {
      expect(cipherInScope(buildCipher(), trashScope)).toBe(false);
      expect(cipherInScope(archived(buildCipher()), trashScope)).toBe(false);
    });
  });

  describe("archive", () => {
    it("keeps archived ciphers from every vault", () => {
      expect(cipherInScope(archived(buildCipher()), archiveScope)).toBe(true);
      expect(cipherInScope(archived(buildCipher(organizationId)), archiveScope)).toBe(true);
      expect(cipherInScope(archived(buildCipher(otherOrganizationId)), archiveScope)).toBe(true);
    });

    it("drops an archived cipher once it is trashed, which owns it from then on", () => {
      expect(cipherInScope(trashed(archived(buildCipher())), archiveScope)).toBe(false);
    });

    it("drops active and trashed ciphers", () => {
      expect(cipherInScope(buildCipher(), archiveScope)).toBe(false);
      expect(cipherInScope(trashed(buildCipher()), archiveScope)).toBe(false);
    });
  });
});

describe("collectionInScope", () => {
  it("keeps every collection for All items", () => {
    expect(collectionInScope(buildCollection(organizationId), ALL_ITEMS_SCOPE)).toBe(true);
  });

  it("drops every collection for the personal vault, which has none", () => {
    expect(collectionInScope(buildCollection(organizationId), myVaultScope)).toBe(false);
  });

  it("keeps only the organization's collections for an organization vault", () => {
    expect(collectionInScope(buildCollection(organizationId), organizationScope)).toBe(true);
    expect(collectionInScope(buildCollection(otherOrganizationId), organizationScope)).toBe(false);
  });

  it("keeps every collection for trash and archive, which span every vault", () => {
    expect(collectionInScope(buildCollection(organizationId), trashScope)).toBe(true);
    expect(collectionInScope(buildCollection(otherOrganizationId), archiveScope)).toBe(true);
  });
});

describe("organizationInScope", () => {
  it("keeps every organization for All items", () => {
    expect(organizationInScope(buildOrganization(organizationId), ALL_ITEMS_SCOPE)).toBe(true);
  });

  it("drops every organization for the personal vault", () => {
    expect(organizationInScope(buildOrganization(organizationId), myVaultScope)).toBe(false);
  });

  it("keeps only the scoped organization for an organization vault", () => {
    expect(organizationInScope(buildOrganization(organizationId), organizationScope)).toBe(true);
    expect(organizationInScope(buildOrganization(otherOrganizationId), organizationScope)).toBe(
      false,
    );
  });

  it("keeps every organization for trash and archive, which span every vault", () => {
    expect(organizationInScope(buildOrganization(organizationId), trashScope)).toBe(true);
    expect(organizationInScope(buildOrganization(otherOrganizationId), archiveScope)).toBe(true);
  });
});
