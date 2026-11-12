import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import {
  PAM_TEST_ORGANIZATION_ID,
  pamTestAccountService,
} from "../shared/testing/pam-test-helpers";

import { PamCollectionsService } from "./pam-collections.service";

describe("PamCollectionsService", () => {
  const collectionService = mock<CollectionService>();

  function view(id: string, org: string, name: string, governed: boolean) {
    const v = new CollectionView({
      id: id as CollectionId,
      organizationId: org as OrganizationId,
      name,
    });
    v.hasEnabledAccessRule = governed;
    return v;
  }

  it("lists only the organization's collections with the governed marker", async () => {
    collectionService.decryptedCollections$.mockReturnValue(
      of([
        view("a", PAM_TEST_ORGANIZATION_ID, "Prod", true),
        view("b", PAM_TEST_ORGANIZATION_ID, "Dev", false),
        view("c", "other-org", "Else", true),
      ]),
    );
    const service = new PamCollectionsService(collectionService, pamTestAccountService());

    expect(await service.list(PAM_TEST_ORGANIZATION_ID)).toEqual([
      {
        id: "a",
        organizationId: PAM_TEST_ORGANIZATION_ID,
        name: "Prod",
        hasEnabledAccessRule: true,
      },
      {
        id: "b",
        organizationId: PAM_TEST_ORGANIZATION_ID,
        name: "Dev",
        hasEnabledAccessRule: false,
      },
    ]);
  });
});
