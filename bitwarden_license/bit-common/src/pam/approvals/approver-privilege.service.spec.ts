import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";

import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "../shared/testing/pam-test-helpers";

import { ApproverPrivilegeService } from "./approver-privilege.service";

const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333" as UserId;

function managedCollection(manage: boolean): CollectionView {
  const view = new CollectionView({
    id: "c1" as CollectionId,
    organizationId: PAM_TEST_ORGANIZATION_ID,
    name: "Prod",
  });
  view.manage = manage;
  return view;
}

describe("ApproverPrivilegeService", () => {
  let organizationService: ReturnType<typeof mock<OrganizationService>>;
  let collectionService: ReturnType<typeof mock<CollectionService>>;

  function createService(accountService: AccountService = pamTestAccountService()) {
    return new ApproverPrivilegeService(organizationService, collectionService, accountService);
  }

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    collectionService = mock<CollectionService>();
    organizationService.organizations$.mockReturnValue(of([]));
    collectionService.decryptedCollections$.mockReturnValue(of([]));
  });

  it("approves a member with Manage on a collection of a PAM organization", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(of([managedCollection(true)]));

    expect(await createService().canApprove(PAM_TEST_USER_ID)).toBe(true);
  });

  it("refuses a member who only has access, not Manage", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(of([managedCollection(false)]));

    expect(await createService().canApprove(PAM_TEST_USER_ID)).toBe(false);
  });

  it("approves an owner with all-items access and no collections synced", async () => {
    organizationService.organizations$.mockReturnValue(
      of([
        pamTestOrganization({
          type: OrganizationUserType.Owner,
          allowAdminAccessToAllCollectionItems: true,
        }),
      ]),
    );

    expect(await createService().canApprove(PAM_TEST_USER_ID)).toBe(true);
  });

  it("refuses when the synced state has no organizations", async () => {
    collectionService.decryptedCollections$.mockReturnValue(of([managedCollection(true)]));

    expect(await createService().canApprove(PAM_TEST_USER_ID)).toBe(false);
  });

  it("refuses, without reading synced state, when there is no active account", async () => {
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of(null);

    expect(await createService(accountService).canApprove()).toBe(false);
    expect(organizationService.organizations$).not.toHaveBeenCalled();
    expect(collectionService.decryptedCollections$).not.toHaveBeenCalled();
  });

  it("uses the active account when no user id is given", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(of([managedCollection(true)]));

    expect(await createService(pamTestAccountService(OTHER_USER_ID)).canApprove()).toBe(true);
    expect(organizationService.organizations$).toHaveBeenCalledWith(OTHER_USER_ID);
    expect(collectionService.decryptedCollections$).toHaveBeenCalledWith(OTHER_USER_ID);
  });

  it("prefers an explicit user id over the active account", async () => {
    await createService(pamTestAccountService(OTHER_USER_ID)).canApprove(PAM_TEST_USER_ID);

    expect(organizationService.organizations$).toHaveBeenCalledWith(PAM_TEST_USER_ID);
    expect(collectionService.decryptedCollections$).toHaveBeenCalledWith(PAM_TEST_USER_ID);
  });

  it("does not approve when reading the synced organizations fails", async () => {
    organizationService.organizations$.mockReturnValue(throwError(() => new Error("state")));

    await expect(createService().canApprove(PAM_TEST_USER_ID)).rejects.toThrow("state");
  });

  it("does not approve when reading the synced collections fails", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    collectionService.decryptedCollections$.mockReturnValue(throwError(() => new Error("locked")));

    await expect(createService().canApprove(PAM_TEST_USER_ID)).rejects.toThrow("locked");
  });
});
