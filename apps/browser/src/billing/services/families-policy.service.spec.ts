// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { FamiliesPolicyService } from "./families-policy.service"; // Adjust the import as necessary

describe("FamiliesPolicyService", () => {
  let service: FamiliesPolicyService;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let accountService: FakeAccountService;
  const userId = Utils.newGuid() as UserId;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    accountService = mockAccountServiceWith(userId);

    TestBed.configureTestingModule({
      providers: [
        FamiliesPolicyService,
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: AccountService, useValue: accountService },
      ],
    });

    service = TestBed.inject(FamiliesPolicyService);
  });

  it("should return false when there are no enterprise organizations", async () => {
    jest.spyOn(service, "hasSingleEnterpriseOrg$").mockReturnValue(of(false));

    const result = await firstValueFrom(service.isFreeFamilyPolicyEnabled$());
    expect(result).toBe(false);
  });

  it("should return true when the policy is enabled for the one enterprise organization", async () => {
    jest.spyOn(service, "hasSingleEnterpriseOrg$").mockReturnValue(of(true));

    const organizations = [{ id: "org1", canManageSponsorships: true }] as Organization[];
    organizationService.organizations$.mockReturnValue(of(organizations));

    const policies = [{ organizationId: "org1", enabled: true }] as Policy[];
    policyService.policiesByType$.mockReturnValue(of(policies));

    const result = await firstValueFrom(service.isFreeFamilyPolicyEnabled$());
    expect(result).toBe(true);
  });

  it("should return false when the policy is not enabled for the one enterprise organization", async () => {
    jest.spyOn(service, "hasSingleEnterpriseOrg$").mockReturnValue(of(true));

    const organizations = [{ id: "org1", canManageSponsorships: true }] as Organization[];
    organizationService.organizations$.mockReturnValue(of(organizations));

    const policies = [{ organizationId: "org1", enabled: false }] as Policy[];
    policyService.policiesByType$.mockReturnValue(of(policies));

    const result = await firstValueFrom(service.isFreeFamilyPolicyEnabled$());
    expect(result).toBe(false);
  });

  it("should return true when there is exactly one enterprise organization that can manage sponsorships", async () => {
    const organizations = [{ id: "org1", canManageSponsorships: true }] as Organization[];
    organizationService.organizations$.mockReturnValue(of(organizations));

    const result = await firstValueFrom(service.hasSingleEnterpriseOrg$());
    expect(result).toBe(true);
  });

  it("should return false when there are multiple organizations that can manage sponsorships", async () => {
    const organizations = [
      { id: "org1", canManageSponsorships: true },
      { id: "org2", canManageSponsorships: true },
    ] as Organization[];
    organizationService.organizations$.mockReturnValue(of(organizations));

    const result = await firstValueFrom(service.hasSingleEnterpriseOrg$());
    expect(result).toBe(false);
  });
});
