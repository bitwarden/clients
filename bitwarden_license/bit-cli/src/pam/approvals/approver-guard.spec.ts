import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { NOT_AN_APPROVER_MESSAGE } from "@bitwarden/bit-common/pam/approvals";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import type { ServiceContainer } from "../../service-container";

import { refuseNonApprover } from "./approver-guard";

describe("refuseNonApprover", () => {
  const container = mock<ServiceContainer>();
  const organizationService = mock<OrganizationService>();
  const collectionService = mock<CollectionService>();

  const collection = (manage: boolean) => {
    const view = new CollectionView({
      id: "c1" as CollectionId,
      organizationId: PAM_TEST_ORGANIZATION_ID as OrganizationId,
      name: "Prod",
    });
    view.manage = manage;
    return view;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(container, {
      organizationService,
      collectionService,
      accountService: pamTestAccountService(),
    });
  });

  it("lets a user who manages a collection of an organization that uses PAM through", async () => {
    organizationService.organizations$.mockReturnValue(
      of([
        pamTestOrganization({
          type: OrganizationUserType.Admin,
          allowAdminAccessToAllCollectionItems: false,
        }),
      ]),
    );
    collectionService.decryptedCollections$.mockReturnValue(of([collection(true)]));

    await expect(refuseNonApprover(container, PAM_TEST_USER_ID)).resolves.toBeUndefined();
  });

  it("refuses a user who manages no collection", async () => {
    organizationService.organizations$.mockReturnValue(
      of([
        pamTestOrganization({
          type: OrganizationUserType.Admin,
          allowAdminAccessToAllCollectionItems: false,
        }),
      ]),
    );
    collectionService.decryptedCollections$.mockReturnValue(of([collection(false)]));

    const refusal = await refuseNonApprover(container, PAM_TEST_USER_ID);

    expect(refusal?.success).toBe(false);
    expect((refusal as { message?: string }).message).toBe(NOT_AN_APPROVER_MESSAGE);
  });

  it("refuses a user who belongs to no organization", async () => {
    organizationService.organizations$.mockReturnValue(of([]));
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const refusal = await refuseNonApprover(container, PAM_TEST_USER_ID);

    expect((refusal as { message?: string }).message).toBe(NOT_AN_APPROVER_MESSAGE);
  });

  it("refuses when the organization does not use PAM, even if the user manages a collection", async () => {
    organizationService.organizations$.mockReturnValue(
      of([pamTestOrganization({ type: OrganizationUserType.Admin, usePam: false })]),
    );
    collectionService.decryptedCollections$.mockReturnValue(of([collection(true)]));

    const refusal = await refuseNonApprover(container, PAM_TEST_USER_ID);

    expect((refusal as { message?: string }).message).toBe(NOT_AN_APPROVER_MESSAGE);
  });
});
