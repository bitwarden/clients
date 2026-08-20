import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { isGuid } from "@bitwarden/guid";

/**
 * The `:vaultId` route segment for the personal vault.
 *
 * Deliberately not the vault table's `MY_VAULT` chip sentinel: that value is an internal filter
 * key, while this one is a URL a user can bookmark and share.
 */
export const MY_VAULT_ROUTE = "my-vault";

export const VaultScopeType = Object.freeze({
  AllItems: "allItems",
  MyVault: "myVault",
  Organization: "organization",
} as const);
export type VaultScopeType = (typeof VaultScopeType)[keyof typeof VaultScopeType];

/**
 * The vault the side nav has narrowed the page to, independent of the table's own filter chips.
 */
export type VaultScope =
  | { type: typeof VaultScopeType.AllItems }
  | { type: typeof VaultScopeType.MyVault }
  | { type: typeof VaultScopeType.Organization; organizationId: OrganizationId };

export const ALL_ITEMS_SCOPE: VaultScope = { type: VaultScopeType.AllItems };

/**
 * Reads the `:vaultId` route segment. An absent segment is "All items"; anything that isn't
 * {@link MY_VAULT_ROUTE} or a guid names no vault and yields `null`.
 *
 * Whether a guid names an organization the user is actually a member of is left to
 * `vaultScopeGuard` — resolving that needs the org list, and making every caller await it would
 * flash the unscoped vault while the list loads.
 */
export function parseVaultScope(segment: string | null | undefined): VaultScope | null {
  if (segment == null) {
    return ALL_ITEMS_SCOPE;
  }

  if (segment === MY_VAULT_ROUTE) {
    return { type: VaultScopeType.MyVault };
  }

  if (isGuid(segment)) {
    return { type: VaultScopeType.Organization, organizationId: segment as OrganizationId };
  }

  return null;
}

/**
 * The `Router.navigate` commands for a scope — the single place vault scope URLs are built, so
 * the nav and the route parser can't drift.
 */
export function vaultScopeCommands(scope: VaultScope): string[] {
  switch (scope.type) {
    case VaultScopeType.MyVault:
      return ["/vault", MY_VAULT_ROUTE];
    case VaultScopeType.Organization:
      return ["/vault", scope.organizationId];
    default:
      return ["/vault"];
  }
}

/**
 * Cipher ids are branded SDK types on `CipherListView` but plain strings on `CipherView`, so an
 * organization id read off `CipherViewLike` needs widening before it can be compared.
 */
const idString = (id: unknown): string | undefined => (id == null ? undefined : String(id));

/** Whether a cipher belongs to the scoped vault. */
export function cipherInScope(cipher: CipherViewLike, scope: VaultScope): boolean {
  const organizationId = idString(cipher.organizationId);

  switch (scope.type) {
    case VaultScopeType.MyVault:
      return organizationId == null;
    case VaultScopeType.Organization:
      return organizationId === scope.organizationId;
    default:
      return true;
  }
}

/**
 * Whether a collection belongs to the scoped vault. The personal vault has no collections, so
 * every one of them falls outside it.
 */
export function collectionInScope(collection: CollectionView, scope: VaultScope): boolean {
  switch (scope.type) {
    case VaultScopeType.MyVault:
      return false;
    case VaultScopeType.Organization:
      return idString(collection.organizationId) === scope.organizationId;
    default:
      return true;
  }
}

/** Whether an organization owns the scoped vault. Mirrors {@link collectionInScope}. */
export function organizationInScope(organization: Organization, scope: VaultScope): boolean {
  switch (scope.type) {
    case VaultScopeType.MyVault:
      return false;
    case VaultScopeType.Organization:
      return idString(organization.id) === scope.organizationId;
    default:
      return true;
  }
}
