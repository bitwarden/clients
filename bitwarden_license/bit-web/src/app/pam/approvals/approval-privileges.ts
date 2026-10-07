import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Whether the user may decide access requests. Mirrors the server's
 * `ApproverCollectionAccessQuery`, not `canManageAccessRules` (rule authoring), and excludes
 * providers, for whom the server sets `AccessPam = false`.
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
