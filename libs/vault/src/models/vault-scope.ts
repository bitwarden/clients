import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { isGuid } from "@bitwarden/guid";

import { VaultsNavViewModel } from "./vault-nav-view-model";

/**
 * The `:vaultId` route segment for the personal vault.
 *
 * Deliberately not the vault table's `MY_VAULT` chip sentinel: that value is an internal filter
 * key, while this one is a URL a user can bookmark and share.
 */
export const MY_VAULT_ROUTE = "my-vault";

/** The `:vaultId` route segment for trashed items. */
export const TRASH_ROUTE = "trash";

/** The `:vaultId` route segment for archived items. */
export const ARCHIVE_ROUTE = "archive";

export const VaultScopeType = Object.freeze({
  AllItems: "allItems",
  MyVault: "myVault",
  Organization: "organization",
  Trash: "trash",
  Archive: "archive",
} as const);
export type VaultScopeType = (typeof VaultScopeType)[keyof typeof VaultScopeType];

/**
 * The destination the side nav has narrowed the page to, independent of the table's own filter
 * chips.
 *
 * The nav presents these as siblings, so a scope covers both dimensions the destinations vary in:
 * which vault an item belongs to, and what state it is in. Trash and Archive span every vault,
 * the way All items does — see {@link cipherInScope}.
 */
export type VaultScope =
  | { type: typeof VaultScopeType.AllItems }
  | { type: typeof VaultScopeType.MyVault }
  | { type: typeof VaultScopeType.Organization; organizationId: OrganizationId }
  | { type: typeof VaultScopeType.Trash }
  | { type: typeof VaultScopeType.Archive };

export const ALL_ITEMS_SCOPE: VaultScope = { type: VaultScopeType.AllItems };

/** The scopes named by a fixed route segment rather than an organization id. */
const NAMED_SCOPES = new Map<string, VaultScope>([
  [MY_VAULT_ROUTE, { type: VaultScopeType.MyVault }],
  [TRASH_ROUTE, { type: VaultScopeType.Trash }],
  [ARCHIVE_ROUTE, { type: VaultScopeType.Archive }],
]);

/**
 * Reads the `:vaultId` route segment. An absent segment is "All items"; anything that is neither a
 * {@link NAMED_SCOPES} segment nor a guid names no destination and yields `null`.
 *
 * Whether a guid names an organization the user is actually a member of is left to
 * `vaultScopeGuard` — resolving that needs the org list, and making every caller await it would
 * flash the unscoped vault while the list loads.
 */
export function parseVaultScope(segment: string | null | undefined): VaultScope | null {
  if (segment == null) {
    return ALL_ITEMS_SCOPE;
  }

  const named = NAMED_SCOPES.get(segment);
  if (named != null) {
    return named;
  }

  if (isGuid(segment)) {
    return { type: VaultScopeType.Organization, organizationId: segment as OrganizationId };
  }

  return null;
}

/**
 * Whether every vault the account can reach is the personal one. Data ownership also leaves one
 * vault, but that one is an organization's, and personal items may still exist outside it.
 */
export function isPersonalOnly(nav: VaultsNavViewModel): boolean {
  return nav.vaults.length === 1 && !nav.organizationDataOwnership;
}

/**
 * {@link parseVaultScope}, with All items resolved to My vault for an {@link isPersonalOnly}
 * account — the same destination for them, so branching on the scope type gives one answer
 * whichever of the two URLs they arrived by.
 *
 * `nav` is `undefined` until the account's vaults load; All items is the safe answer meanwhile,
 * since it shows a superset.
 */
export function resolveVaultScope(
  segment: string | null | undefined,
  nav: VaultsNavViewModel | undefined,
): VaultScope | null {
  const scope = parseVaultScope(segment);

  if (scope?.type === VaultScopeType.AllItems && nav != null && isPersonalOnly(nav)) {
    return { type: VaultScopeType.MyVault };
  }

  return scope;
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
    case VaultScopeType.Trash:
      return ["/vault", TRASH_ROUTE];
    case VaultScopeType.Archive:
      return ["/vault", ARCHIVE_ROUTE];
    default:
      return ["/vault"];
  }
}

/**
 * Cipher ids are branded SDK types on `CipherListView` but plain strings on `CipherView`, so an
 * organization id read off `CipherViewLike` needs widening before it can be compared.
 */
const idString = (id: unknown): string | undefined => (id == null ? undefined : String(id));

/**
 * Whether a cipher belongs in the scope — the single place both dimensions of a scope are decided,
 * so no caller has to pair a vault filter with a state filter and risk getting one of them wrong.
 *
 * Every vault scope shows active items only. Trash and Archive invert that and span every vault,
 * and a trashed item stays in Trash whether or not it was archived when it was deleted.
 */
export function cipherInScope(cipher: CipherViewLike, scope: VaultScope): boolean {
  const deleted = CipherViewLikeUtils.isDeleted(cipher);
  const archived = CipherViewLikeUtils.isArchived(cipher);
  const organizationId = idString(cipher.organizationId);

  switch (scope.type) {
    case VaultScopeType.Trash:
      return deleted;
    case VaultScopeType.Archive:
      return archived && !deleted;
    case VaultScopeType.MyVault:
      return !deleted && !archived && organizationId == null;
    case VaultScopeType.Organization:
      return !deleted && !archived && organizationId === scope.organizationId;
    default:
      return !deleted && !archived;
  }
}

/**
 * Whether a collection belongs to the scoped vault. Trash and Archive span every vault, so they
 * keep the lot; the personal vault has no collections, so it keeps none.
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
