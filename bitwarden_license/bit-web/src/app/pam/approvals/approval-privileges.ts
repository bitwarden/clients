import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Whether the user these memberships and collections belong to can act on other members'
 * access requests: Manage on at least one collection in a PAM-entitled organization.
 *
 * Distinct from `Organization.canManageAccessRules` (authoring rules, not deciding on them).
 * Mirrors the server's `ApproverCollectionAccessQuery`: Manage-assigned collections, plus every
 * collection in an organization the user can manage all of without assignment.
 *
 * Provider users are excluded, since the server sets `AccessPam = false` for them regardless
 * of their apparent Owner role.
 */
export function hasApprovalPrivileges(
  organizations: Organization[],
  collections: CollectionView[],
): boolean {
  return organizations.some(
    (organization) =>
      organization.usePam &&
      !organization.isProviderUser &&
      (organization.canEditAllCiphers ||
        collections.some(
          (collection) => collection.manage && collection.organizationId === organization.id,
        )),
  );
}
