import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";

import { RestrictedItemTypesService } from "./restricted-item-types.service";

describe("RestrictedItemTypesService", () => {
  let policyService: MockProxy<PolicyService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let configService: MockProxy<ConfigService>;
  let fakeAccount: Account | null;

  const org1: Organization = {
    id: "org1",
    status: 0,
    usePolicies: true,
    isOwner: false,
    isAdmin: false,
    canManagePolicies: false,
  } as Organization;

  const org2: Organization = {
    id: "org2",
    status: 0,
    usePolicies: true,
    isOwner: false,
    isAdmin: false,
    canManagePolicies: false,
  } as Organization;

  beforeEach(() => {
    policyService = mock<PolicyService>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();

    fakeAccount = { id: Utils.newGuid() as UserId } as Account | null;
    // Make activeAccount$ always emit our fakeAccount:
    accountService.activeAccount$ = of(fakeAccount);

    TestBed.configureTestingModule({
      providers: [
        // we do not inject RestrictedItemTypesService here; we'll do it in each spec
        { provide: PolicyService, useValue: policyService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: configService },
      ],
    });
  });

  it("emits empty array when feature flag is disabled", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([]);
  });

  it("emits empty array if no organizations exist", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([]));
    policyService.policies$.mockReturnValue(of([]));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([]);
  });

  it("handles a single org with an enabled policy that has undefined data (defaults to [Card], allowView=false)", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of<Organization[]>([org1]));

    const policyForOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: undefined,
    } as unknown as Policy;
    policyService.policies$.mockReturnValue(of([policyForOrg1]));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([{ cipherType: CipherType.Card, allowView: false }]);
  });

  it("if one org restricts Card and another org has no enabled policy, allowView=true for Card", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of<Organization[]>([org1, org2]));

    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Card],
    } as unknown as Policy;

    // Org2 has an entry but enabled=false, so effectively no restriction
    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: false,
      data: [CipherType.Card],
    } as unknown as Policy;

    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([{ cipherType: CipherType.Card, allowView: true }]);
  });

  it("if all orgs restrict Login, allowView=false for Login", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of<Organization[]>([org1, org2]));

    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login],
    } as unknown as Policy;

    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login],
    } as unknown as Policy;

    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([{ cipherType: CipherType.Login, allowView: false }]);
  });

  it("aggregates multiple cipher types across orgs and computes allowView correctly", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of<Organization[]>([org1, org2]));

    // Org1 restricts [Card, Login]
    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Card, CipherType.Login],
    } as unknown as Policy;
    // Org2 restricts [Login, Identity]
    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login, CipherType.Identity],
    } as unknown as Policy;

    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);

    const result = await firstValueFrom(service.restricted$);

    // unionRestricted = { Card, Login, Identity }
    // • Card: org1 restricts, org2 does not → allowView = true
    // • Login: both restrict → allowView = false
    // • Identity: org1 does not restrict, org2 restricts → allowView = true
    expect(result).toEqual([
      { cipherType: CipherType.Card, allowView: true },
      { cipherType: CipherType.Login, allowView: false },
      { cipherType: CipherType.Identity, allowView: true },
    ]);
  });
});
