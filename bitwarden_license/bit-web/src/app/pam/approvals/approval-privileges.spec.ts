import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { hasApprovalPrivileges } from "./approval-privileges";

const pamOrgId = "org-1" as OrganizationId;
const otherOrgId = "org-2" as OrganizationId;

/** PAM-entitled, with no organization-wide collection authority unless overridden. */
function org(
  options: {
    id?: OrganizationId;
    usePam?: boolean;
    canEditAllCiphers?: boolean;
    isProviderUser?: boolean;
  } = {},
): Organization {
  const {
    id = pamOrgId,
    usePam = true,
    canEditAllCiphers = false,
    isProviderUser = false,
  } = options;
  return { id, usePam, canEditAllCiphers, isProviderUser } as Organization;
}

function collection(organizationId: OrganizationId, manage: boolean): CollectionView {
  return { organizationId, manage } as CollectionView;
}

describe("hasApprovalPrivileges", () => {
  it("grants on Manage over a collection, whatever the organization role", () => {
    expect(hasApprovalPrivileges([org()], [collection(pamOrgId, true)])).toBe(true);
  });

  it("grants on organization-wide collection access with no assignment of one's own", () => {
    // The server folds every org collection into an Admin/Owner's manageable set when the org
    // allows it.
    expect(hasApprovalPrivileges([org({ canEditAllCiphers: true })], [])).toBe(true);
  });

  it("denies anyone holding no collection Manage", () => {
    // Covers a member without Manage and an Admin the org doesn't let reach all items; neither
    // holds Manage.
    expect(hasApprovalPrivileges([org()], [])).toBe(false);
    expect(hasApprovalPrivileges([org()], [collection(pamOrgId, false)])).toBe(false);
  });

  it("does not credit Manage in one organization to another", () => {
    expect(hasApprovalPrivileges([org()], [collection(otherOrgId, true)])).toBe(false);
  });

  it("denies a provider user, whose client organization arrives typed as Owner", () => {
    // `canEditAllCiphers` is true for a provider, but the server sets AccessPam = false and
    // folds in no collections.
    const providerOrg = org({ canEditAllCiphers: true, isProviderUser: true });

    expect(hasApprovalPrivileges([providerOrg], [])).toBe(false);
    expect(hasApprovalPrivileges([providerOrg], [collection(pamOrgId, true)])).toBe(false);
  });

  it("ignores Manage in an organization not entitled to PAM", () => {
    const unentitled = org({ id: otherOrgId, usePam: false, canEditAllCiphers: true });

    expect(hasApprovalPrivileges([unentitled], [collection(otherOrgId, true)])).toBe(false);
  });

  it("is satisfied by ANY organization, because the page is user-global", () => {
    const unentitled = org({ id: otherOrgId, usePam: false });

    expect(hasApprovalPrivileges([unentitled, org()], [collection(pamOrgId, true)])).toBe(true);
  });

  it("denies a user who belongs to no organization at all", () => {
    expect(hasApprovalPrivileges([], [])).toBe(false);
  });
});
