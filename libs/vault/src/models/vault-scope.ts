import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { isGuid } from "@bitwarden/guid";

import { VaultNavItemType, VaultsNavViewModel } from "./vault-nav-view-model";

/**
 * The `:vaultId` route segment for the personal vault.
 *
 * Deliberately not the vault table's `MY_VAULT` chip sentinel: that value is an internal filter
 * key, while this one is a URL a user can bookmark and share.
 */
export const MY_VAULT_ROUTE = "my-vault";

/**
 * The `:collectionId` route segment for an organization's "My items" collection — the default user
 * collection an organization under the data ownership policy gives each of its members.
 *
 * A URL names it by this sentinel rather than by its id, for the same reason
 * {@link MY_VAULT_ROUTE} exists: the nav offers one "My items" entry per organization, and the id
 * behind it differs per member, so only the sentinel is a link that can be written down — see
 * {@link resolveVaultScope}, which trades it for the id.
 */
export const MY_ITEMS_ROUTE = "my-items";

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
 * The collection a URL drills an organization vault into: its id outright, or
 * {@link MY_ITEMS_ROUTE} for the organization's "My items" collection, whose id the URL cannot
 * name. {@link resolveVaultScope} trades the sentinel for the id the nav holds; every function
 * that narrows by a collection compares ids, so an unresolved sentinel matches nothing.
 */
export type ScopedCollectionId = CollectionId | typeof MY_ITEMS_ROUTE;

/**
 * The destination the side nav has narrowed the page to, independent of the table's own filter
 * chips.
 *
 * The nav presents these as siblings, so a scope covers both dimensions the destinations vary in:
 * which vault an item belongs to, and what state it is in. Trash and Archive span every vault,
 * the way All items does — see {@link cipherInScope}.
 *
 * An organization vault carries a third dimension: the shared folder the page has drilled into,
 * which the nav has no entry for but the URL names — see {@link parseVaultScope}.
 */
export type VaultScope =
  | { type: typeof VaultScopeType.AllItems }
  | { type: typeof VaultScopeType.MyVault }
  | {
      type: typeof VaultScopeType.Organization;
      organizationId: OrganizationId;
      /** The shared folder in view, when the URL drills into one. */
      collectionId?: ScopedCollectionId;
    }
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
 * Reads the `:vaultId` and `:collectionId` route segments. An absent vault segment is "All items";
 * anything that is neither a {@link NAMED_SCOPES} segment nor a guid names no destination and
 * yields `null`.
 *
 * The collection segment drills the vault into one of its shared folders, or into
 * {@link MY_ITEMS_ROUTE}. Only an organization vault can be drilled into: a collection belongs to
 * an organization, and the vault a personal one, Trash, or the Archive would drill into is that
 * organization's rather than their own — so a collection segment alongside any other scope names no
 * destination and yields `null` too.
 *
 * Whether a guid names an organization the user is actually a member of, or a collection within
 * it, is left to `vaultScopeGuard` — resolving that needs the org list, and making every caller
 * await it would flash the unscoped vault while the list loads. The same goes for whether an
 * organization has a "My items" collection at all, which only those under data ownership do.
 */
export function parseVaultScope(
  segment: string | null | undefined,
  collectionSegment?: string | null,
): VaultScope | null {
  const scope = parseVaultSegment(segment);

  if (collectionSegment == null) {
    return scope;
  }

  if (scope?.type !== VaultScopeType.Organization || !isScopedCollectionId(collectionSegment)) {
    return null;
  }

  return { ...scope, collectionId: collectionSegment };
}

/** Whether a collection segment names a collection at all — see {@link ScopedCollectionId}. */
function isScopedCollectionId(segment: string): segment is ScopedCollectionId {
  return segment === MY_ITEMS_ROUTE || isGuid(segment);
}

/** The `:vaultId` segment on its own — see {@link parseVaultScope}. */
function parseVaultSegment(segment: string | null | undefined): VaultScope | null {
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
 * The id of an organization's "My items" collection, as the nav holds it. `undefined` when the
 * account's vaults have yet to load, when the organization is not one of them, or when it has no
 * such collection — only organizations under the data ownership policy do.
 */
export function defaultUserCollectionId(
  organizationId: OrganizationId,
  nav: VaultsNavViewModel | undefined,
): CollectionId | undefined {
  return nav?.vaults.find(
    ({ id, type }) => type !== VaultNavItemType.Personal && id === organizationId,
  )?.defaultUserCollectionId;
}

/**
 * {@link parseVaultScope}, with the two segments only the nav can resolve given their answer:
 * All items becomes My vault for an {@link isPersonalOnly} account — the same destination for them,
 * so branching on the scope type gives one answer whichever of the two URLs they arrived by — and
 * a {@link MY_ITEMS_ROUTE} collection segment becomes the id of the organization's "My items"
 * collection, which is what every function narrowing by a collection compares against.
 *
 * `nav` is `undefined` until the account's vaults load. All items is the safe answer meanwhile,
 * since it shows a superset, and a "My items" segment stays as it came — resolving it needs the
 * nav, and the alternative, widening to the whole organization vault, would show items the URL did
 * not ask for.
 *
 * An organization with no "My items" collection names no destination by that segment, so it yields
 * `null` the way an unknown vault segment does.
 */
export function resolveVaultScope(
  segment: string | null | undefined,
  collectionSegment: string | null | undefined,
  nav: VaultsNavViewModel | undefined,
): VaultScope | null {
  const scope = parseVaultScope(segment, collectionSegment);

  if (scope?.type === VaultScopeType.AllItems && nav != null && isPersonalOnly(nav)) {
    return { type: VaultScopeType.MyVault };
  }

  if (scope?.type === VaultScopeType.Organization && scope.collectionId === MY_ITEMS_ROUTE) {
    if (nav == null) {
      return scope;
    }

    const collectionId = defaultUserCollectionId(scope.organizationId, nav);
    return collectionId == null ? null : { ...scope, collectionId };
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
      return scope.collectionId == null
        ? ["/vault", scope.organizationId]
        : ["/vault", scope.organizationId, scope.collectionId];
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
 * The shared folder the scope has drilled into, or `undefined` when it covers a whole vault. Only
 * an organization vault can be drilled into — see {@link parseVaultScope}.
 *
 * A scope {@link resolveVaultScope} has yet to resolve names its folder by the
 * {@link MY_ITEMS_ROUTE} sentinel rather than by an id — see {@link ScopedCollectionId}.
 */
export function scopedSharedFolderId(scope: VaultScope): ScopedCollectionId | undefined {
  return scope.type === VaultScopeType.Organization ? scope.collectionId : undefined;
}

/**
 * Whether a cipher belongs in the scope — the single place every dimension of a scope is decided,
 * so no caller has to pair a vault filter with a state filter and risk getting one of them wrong.
 *
 * Every vault scope shows active items only. Trash and Archive invert that and span every vault,
 * and a trashed item stays in Trash whether or not it was archived when it was deleted.
 *
 * A scope drilled into a shared folder keeps that folder's own items and no others: a child
 * folder's items arrive with the drill-in to the child.
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
    case VaultScopeType.Organization: {
      if (deleted || archived || organizationId !== scope.organizationId) {
        return false;
      }
      const { collectionId } = scope;
      return (
        collectionId == null ||
        (cipher.collectionIds ?? []).some((id) => idString(id) === collectionId)
      );
    }
    default:
      return !deleted && !archived;
  }
}

/**
 * Whether a collection belongs to the scoped vault. Trash and Archive span every vault, so they
 * keep the lot; the personal vault has no collections, so it keeps none.
 *
 * The vault dimension only — a scope drilled into a shared folder still keeps every collection its
 * organization owns, since an item in that folder may belong to others alongside it.
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
