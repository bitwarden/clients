import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "../shared/testing/pam-test-helpers";

import { ApproverPrivilegeService } from "./approver-privilege.service";
import { hasApproverPrivileges } from "./approver-privileges";

const OTHER_ORGANIZATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function collection(organizationId: string, manage: boolean): CollectionView {
  const view = new CollectionView({
    id: "c1" as CollectionId,
    organizationId: organizationId as OrganizationId,
    name: "Prod",
  });
  view.manage = manage;
  return view;
}

describe("hasApproverPrivileges", () => {
  const owner = pamTestOrganization({
    type: OrganizationUserType.Owner,
    allowAdminAccessToAllCollectionItems: true,
  });

  it("accepts an owner, who can edit all items", () => {
    expect(hasApproverPrivileges([owner], [])).toBe(true);
  });

  it("refuses an owner where all-items access is off and without Manage", () => {
    const restricted = pamTestOrganization({
      type: OrganizationUserType.Owner,
      allowAdminAccessToAllCollectionItems: false,
    });
    expect(hasApproverPrivileges([restricted], [])).toBe(false);
  });

  it("accepts an admin where admins can access all collection items", () => {
    const admin = pamTestOrganization({
      type: OrganizationUserType.Admin,
      allowAdminAccessToAllCollectionItems: true,
    });
    expect(hasApproverPrivileges([admin], [])).toBe(true);
  });

  it("refuses an admin without all-items access and without Manage", () => {
    const admin = pamTestOrganization({
      type: OrganizationUserType.Admin,
      allowAdminAccessToAllCollectionItems: false,
    });
    expect(hasApproverPrivileges([admin], [collection(PAM_TEST_ORGANIZATION_ID, false)])).toBe(
      false,
    );
  });

  it("accepts an admin without all-items access who has Manage on a collection", () => {
    const admin = pamTestOrganization({
      type: OrganizationUserType.Admin,
      allowAdminAccessToAllCollectionItems: false,
    });
    expect(hasApproverPrivileges([admin], [collection(PAM_TEST_ORGANIZATION_ID, true)])).toBe(true);
  });

  it("accepts a plain member with Manage on a collection of the organization", () => {
    expect(
      hasApproverPrivileges([pamTestOrganization()], [collection(PAM_TEST_ORGANIZATION_ID, true)]),
    ).toBe(true);
  });

  it("refuses a manager of an unrelated organization's collection", () => {
    expect(
      hasApproverPrivileges([pamTestOrganization()], [collection(OTHER_ORGANIZATION_ID, true)]),
    ).toBe(false);
  });

  it("refuses a provider user, even with Manage", () => {
    const provider = pamTestOrganization({ isProviderUser: true });
    expect(hasApproverPrivileges([provider], [collection(PAM_TEST_ORGANIZATION_ID, true)])).toBe(
      false,
    );
  });

  it("refuses an organization that does not use PAM", () => {
    const off = pamTestOrganization({ usePam: false, type: OrganizationUserType.Owner });
    expect(hasApproverPrivileges([off], [collection(PAM_TEST_ORGANIZATION_ID, true)])).toBe(false);
  });

  it("evaluates across organizations: one qualifying organization is enough", () => {
    const plain = pamTestOrganization({ id: OTHER_ORGANIZATION_ID as OrganizationId });
    expect(
      hasApproverPrivileges(
        [plain, pamTestOrganization()],
        [collection(PAM_TEST_ORGANIZATION_ID, true)],
      ),
    ).toBe(true);
  });

  it("refuses a user with no organizations", () => {
    expect(hasApproverPrivileges([], [collection(PAM_TEST_ORGANIZATION_ID, true)])).toBe(false);
  });
});

describe("ApproverPrivilegeService", () => {
  const organizationService = mock<OrganizationService>();
  const collectionService = mock<CollectionService>();
  const service = new ApproverPrivilegeService(
    organizationService,
    collectionService,
    pamTestAccountService(),
  );

  it("reads the synced organizations and decrypted collections", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(
      of([collection(PAM_TEST_ORGANIZATION_ID, true)]),
    );

    expect(await service.canApprove(PAM_TEST_USER_ID)).toBe(true);
    expect(organizationService.organizations$).toHaveBeenCalledWith(PAM_TEST_USER_ID);
    expect(collectionService.decryptedCollections$).toHaveBeenCalledWith(PAM_TEST_USER_ID);
  });

  it("falls back to the active account", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(of([]));
    expect(await service.canApprove()).toBe(false);
  });
});
