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

import { RestrictedItemTypesService, RestrictedCipherType } from "./restricted-item-types.service";

describe("RestrictedItemTypesService", () => {
  let policyService: MockProxy<PolicyService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let configService: MockProxy<ConfigService>;
  let fakeAccount: Account | null;

  const org1: Organization = { id: "org1" } as any;
  const org2: Organization = { id: "org2" } as any;

  beforeEach(() => {
    policyService = mock<PolicyService>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();

    fakeAccount = { id: Utils.newGuid() as UserId } as Account;
    accountService.activeAccount$ = of(fakeAccount);

    TestBed.configureTestingModule({
      providers: [
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

  it("defaults undefined data to [Card] and returns empty allowViewOrgIds", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([org1]));

    const policyForOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: undefined,
    } as Policy;
    policyService.policies$.mockReturnValue(of([policyForOrg1]));

    const service = TestBed.inject(RestrictedItemTypesService);
    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: [] },
    ]);
  });

  it("if one org restricts Card and another has no policy, allowViewOrgIds contains the unrestricted org", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([org1, org2]));

    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Card],
    } as Policy;
    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: false,
      data: [CipherType.Card],
    } as Policy;
    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);
    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: ["org2"] },
    ]);
  });

  it("returns empty allowViewOrgIds when all orgs restrict Login", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([org1, org2]));

    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login],
    } as Policy;
    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login],
    } as Policy;
    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);
    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Login, allowViewOrgIds: [] },
    ]);
  });

  it("aggregates multiple types and computes allowViewOrgIds correctly", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([org1, org2]));

    const policyOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Card, CipherType.Login],
    } as Policy;
    const policyOrg2 = {
      organizationId: "org2",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: [CipherType.Login, CipherType.Identity],
    } as Policy;
    policyService.policies$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const service = TestBed.inject(RestrictedItemTypesService);
    const result = await firstValueFrom(service.restricted$);

    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: ["org2"] },
      { cipherType: CipherType.Login, allowViewOrgIds: [] },
      { cipherType: CipherType.Identity, allowViewOrgIds: ["org1"] },
    ]);
  });
});
