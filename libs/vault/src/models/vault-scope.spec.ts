import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ALL_ITEMS_SCOPE,
  cipherInScope,
  collectionInScope,
  MY_VAULT_ROUTE,
  organizationInScope,
  parseVaultScope,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "./vault-scope";

const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

const myVaultScope: VaultScope = { type: VaultScopeType.MyVault };
const organizationScope: VaultScope = { type: VaultScopeType.Organization, organizationId };

const buildCipher = (cipherOrganizationId?: string) => {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.organizationId = cipherOrganizationId ?? null;
  return cipher;
};

const buildCollection = (collectionOrganizationId: string) => {
  const collection = new CollectionView({
    id: "collection-1" as CollectionId,
    organizationId: collectionOrganizationId as OrganizationId,
    name: "Collection",
  });
  return collection;
};

const buildOrganization = (id: string) => ({ id }) as Organization;

describe("parseVaultScope", () => {
  it("reads an absent segment as All items", () => {
    expect(parseVaultScope(undefined)).toEqual(ALL_ITEMS_SCOPE);
    expect(parseVaultScope(null)).toEqual(ALL_ITEMS_SCOPE);
  });

  it("reads the my-vault segment as the personal vault", () => {
    expect(parseVaultScope(MY_VAULT_ROUTE)).toEqual(myVaultScope);
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

describe("vaultScopeCommands", () => {
  it.each([
    [ALL_ITEMS_SCOPE, ["/vault"]],
    [myVaultScope, ["/vault", MY_VAULT_ROUTE]],
    [organizationScope, ["/vault", organizationId]],
  ])("builds the route for %p", (scope: VaultScope, expected: string[]) => {
    expect(vaultScopeCommands(scope)).toEqual(expected);
  });

  it("round-trips through parseVaultScope", () => {
    for (const scope of [ALL_ITEMS_SCOPE, myVaultScope, organizationScope]) {
      const [, segment] = vaultScopeCommands(scope);
      expect(parseVaultScope(segment)).toEqual(scope);
    }
  });
});

describe("cipherInScope", () => {
  it("keeps every cipher for All items", () => {
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
});
