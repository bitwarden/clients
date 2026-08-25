import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Whether the user these memberships and collections belong to can act on other members' access
 * requests. The privilege is Manage on at least one collection in a PAM-entitled organization.
 *
 * Deciding a request and authoring the rule behind it are deliberately different authorities.
 * `Organization.canManageAccessRules` (Admin/Owner) gates the access-rules admin UI; it is NOT the
 * approval privilege, and using it here locked every non-admin collection manager out of the inbox
 * the server was already willing to serve them.
 *
 * The two clauses mirror the server's `ApproverCollectionAccessQuery`, which is what actually
 * authorizes the inbox read and the decision:
 *  - collections the user is assigned with Manage. Sync delivers this bit pre-aggregated across
 *    direct and group access, so `CollectionView.manage` is the same signal the server reads.
 *  - every collection in an organization the user can manage all of without an assignment, which
 *    `canEditAllCiphers` expresses with the same two clauses the server folds in: a custom user with
 *    `editAnyCollection`, or an Admin/Owner in an organization that allows admin access to all
 *    collection items. An admin without that allowance holds no collection Manage, and so gets no
 *    "Approvals" tab-link that could only ever lead somewhere empty.
 *
 * The check spans every organization rather than one named in a URL, because the Access requests
 * page is user-global. `usePam` scopes it to organizations entitled to PAM — the only ones that can
 * hold a rule for a request to be filed against.
 *
 * Provider users are excluded explicitly. A provider's client organization arrives with
 * `type: Owner` (`ProfileProviderOrganizationResponseModel`), so it would otherwise satisfy
 * `canEditAllCiphers` — but the server sets `AccessPam = false` for providers and
 * `ApproverCollectionAccessQuery` folds manage-all only over claim-based memberships and confirmed
 * `OrganizationUser` rows, neither of which a provider has. PAM excludes providers deliberately
 * (see the server's `AccessRuleEndpoints` remarks); without this clause a provider admin would get
 * an "Approvals" tab-link leading to a view that can only ever render empty.
 *
 * A pure function over already-loaded state, so the predicate is unit-testable without a TestBed;
 * {@link ApprovalPrivilegeService} owns the streams that feed it.
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
