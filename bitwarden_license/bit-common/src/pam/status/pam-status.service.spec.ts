import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FakeAccountService } from "@bitwarden/common/spec";

import {
  PAM_TEST_ORGANIZATION_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "../shared/testing/pam-test-helpers";

import { PamStatusService } from "./pam-status.service";

describe("PamStatusService", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  let accountService: FakeAccountService;
  let service: PamStatusService;

  beforeEach(() => {
    jest.resetAllMocks();
    accountService = pamTestAccountService();
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(flag === FeatureFlag.PamAccessConnector)) as never);
    service = new PamStatusService(configService, organizationService, accountService);
  });

  it("reports each flag value", async () => {
    organizationService.organizations$.mockReturnValue(of([]));
    const status = await service.getStatus();
    expect(status.flags).toEqual({ pam: false, pamAccessConnector: true });
    expect(status.loggedIn).toBe(true);
  });

  it("reports hints for an admin and a plain member", async () => {
    const admin = pamTestOrganization({ type: OrganizationUserType.Admin });
    const member = pamTestOrganization({
      id: "33333333-3333-4333-8333-333333333333" as never,
      accessPam: false,
    });
    organizationService.organizations$.mockReturnValue(of([admin, member]));

    const status = await service.getStatus();

    expect(status.organizations).toHaveLength(2);
    expect(status.organizations[0]).toMatchObject({
      id: PAM_TEST_ORGANIZATION_ID,
      usePam: true,
      accessPam: true,
      canManageAccessRules: true,
      canManageRotation: true,
    });
    expect(status.organizations[1]).toMatchObject({
      accessPam: false,
      canManageAccessRules: false,
      canManageRotation: false,
    });
  });

  it("filters to one organization", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    expect((await service.getStatus(PAM_TEST_ORGANIZATION_ID)).organizations).toHaveLength(1);
    expect(
      (await service.getStatus("44444444-4444-4444-8444-444444444444")).organizations,
    ).toHaveLength(0);
  });

  it("reports flags only when nobody is logged in", async () => {
    accountService.activeAccountSubject.next(null);
    const status = await service.getStatus();
    expect(status.loggedIn).toBe(false);
    expect(status.organizations).toEqual([]);
    expect(organizationService.organizations$).not.toHaveBeenCalled();
  });
});
