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
  isPersonalOnly,
  MY_VAULT_ROUTE,
  organizationInScope,
  parseVaultScope,
  resolveVaultScope,
  TRASH_ROUTE,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "./vault-scope";

const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

const myVaultScope: VaultScope = { type: VaultScopeType.MyVault };
const organizationScope: VaultScope = { type: VaultScopeType.Organization, organizationId };
const trashScope: VaultScope = { type: VaultScopeType.Trash };
const archiveScope: VaultScope = { type: VaultScopeType.Archive };

const buildCipher = (cipherOrganizationId?: string) => {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.organizationId = cipherOrganizationId ?? null;
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

const buildNavItem = (id: string, type: VaultNavItemType): VaultNavItemViewModel => ({
  id,
  label: id,
  color: "purple",
  icon: "bwi-user",
  type,
});

const buildNav = (
  vaults: VaultNavItemViewModel[],
  organizationDataOwnership = false,
): VaultsNavViewModel => ({ vaults, organizationDataOwnership });

const personalNav = buildNav([buildNavItem("user-1", VaultNavItemType.Personal)]);

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
    expect(resolveVaultScope(undefined, personalNav)).toEqual(myVaultScope);
  });

  it("leaves All items alone for an account with more than one vault", () => {
    const nav = buildNav([
      buildNavItem("user-1", VaultNavItemType.Personal),
      buildNavItem(organizationId, VaultNavItemType.Organization),
    ]);

    expect(resolveVaultScope(undefined, nav)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("leaves All items alone until the account's vaults load", () => {
    expect(resolveVaultScope(undefined, undefined)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("passes every other segment through untouched", () => {
    expect(resolveVaultScope(TRASH_ROUTE, personalNav)).toEqual(trashScope);
    expect(resolveVaultScope(ARCHIVE_ROUTE, personalNav)).toEqual(archiveScope);
    expect(resolveVaultScope(organizationId, personalNav)).toEqual(organizationScope);
    expect(resolveVaultScope("acme-corp", personalNav)).toBeNull();
  });
});

describe("vaultScopeCommands", () => {
  it.each([
    [ALL_ITEMS_SCOPE, ["/vault"]],
    [myVaultScope, ["/vault", MY_VAULT_ROUTE]],
    [organizationScope, ["/vault", organizationId]],
    [trashScope, ["/vault", TRASH_ROUTE]],
    [archiveScope, ["/vault", ARCHIVE_ROUTE]],
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
    ]) {
      const [, segment] = vaultScopeCommands(scope);
      expect(parseVaultScope(segment)).toEqual(scope);
    }
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
