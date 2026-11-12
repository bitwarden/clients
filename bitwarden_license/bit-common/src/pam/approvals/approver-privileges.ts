import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/** The refusal every approval command and `bw serve` route gives a non-approver. */
export const NOT_AN_APPROVER_MESSAGE =
  "You are not an approver. Approving requests needs Manage on a governed collection, or the ability to edit all items in the organization.";

/**
 * Whether the user may decide access requests. Mirrors `hasApprovalPrivileges` in
 * `bitwarden_license/bit-web/src/app/pam/approvals/approval-privileges.ts`, which gates the web's
 * Approvals surface. bit-common cannot import from bit-web, so keep the two predicates identical:
 * change one, change the other.
 *
 * An approver is a member of an organization that uses PAM, who is not a provider user, and who
 * either can edit every item in the organization or has Manage on one of its collections. Being
 * an admin is not enough on its own: `canEditAllCiphers` is false for an admin where the
 * organization does not give admins access to all collection items.
 */
export function hasApproverPrivileges(
  organizations: readonly Organization[],
  collections: readonly CollectionView[],
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
