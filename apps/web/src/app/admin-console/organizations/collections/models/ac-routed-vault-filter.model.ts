import { Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { All, RoutedVaultFilterItemType, RoutedVaultFilterModel } from "@bitwarden/vault";

/**
 * A vault filter model scoped to the Admin Console, where `organizationId` is always
 * a real `OrganizationId` (never `Unassigned` or undefined). This accurately reflects
 * that the Admin Console is always scoped to a specific organization from the route path.
 */
export interface ACRoutedVaultFilterModel {
  organizationId: OrganizationId;
  collectionId?: CollectionId | All | Unassigned;
  type?: RoutedVaultFilterItemType;
}

/**
 * Maps a generic `RoutedVaultFilterModel` to an `ACRoutedVaultFilterModel`, or returns
 * `undefined` if the filter does not represent a valid Admin Console state (i.e. the
 * organization ID is absent or set to `Unassigned`).
 */
export function toACFilter(f: RoutedVaultFilterModel): ACRoutedVaultFilterModel | undefined {
  if (f.organizationId == null || f.organizationId === Unassigned) {
    return undefined;
  }
  return { organizationId: f.organizationId, collectionId: f.collectionId, type: f.type };
}
