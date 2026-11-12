import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { MY_ITEMS_ROUTE, VaultScope, VaultScopeType } from "@bitwarden/vault";

/** The inputs the gated shared-folder banner takes. */
export interface GatedBannerTarget {
  organizationId: OrganizationId;
  collectionId: CollectionId;
}

/**
 * The shared folder the scope has drilled into. Unset on every other page, including an
 * organization's "My items", which is a page of the vault rather than a shared folder.
 */
export function gatedBannerTarget(scope: VaultScope): GatedBannerTarget | undefined {
  if (
    scope.type !== VaultScopeType.Organization ||
    scope.collectionId == null ||
    scope.collectionId === MY_ITEMS_ROUTE
  ) {
    return undefined;
  }
  return { organizationId: scope.organizationId, collectionId: scope.collectionId };
}
