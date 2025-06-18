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
  let service: RestrictedItemTypesService;
  let policyService: MockProxy<PolicyService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let configService: MockProxy<ConfigService>;
  let fakeAccount: Account | null;

  const org1: Organization = { id: "org1" } as any;
  const org2: Organization = { id: "org2" } as any;

  const policyOrg1 = {
    organizationId: "org1",
    type: PolicyType.RestrictedItemTypes,
    enabled: true,
    data: [CipherType.Card],
  } as Policy;

  const policyOrg2 = {
    organizationId: "org2",
    type: PolicyType.RestrictedItemTypes,
    enabled: true,
    data: [CipherType.Card],
  } as Policy;

  beforeEach(() => {
    policyService = mock<PolicyService>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();

    fakeAccount = { id: Utils.newGuid() as UserId } as Account;
    accountService.activeAccount$ = of(fakeAccount);

    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockReturnValue(of([org1, org2]));
    policyService.policiesByType$.mockReturnValue(of([]));

    service = new RestrictedItemTypesService(
      configService,
      accountService,
      organizationService,
      policyService,
    );
  });

  it("emits empty array when feature flag is disabled", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([]);
  });

  it("emits empty array if no organizations exist", async () => {
    organizationService.organizations$.mockReturnValue(of([]));
    policyService.policiesByType$.mockReturnValue(of([]));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([]);
  });

  it("defaults undefined data to [Card] and returns empty allowViewOrgIds", async () => {
    organizationService.organizations$.mockReturnValue(of([org1]));

    const policyForOrg1 = {
      organizationId: "org1",
      type: PolicyType.RestrictedItemTypes,
      enabled: true,
      data: undefined,
    } as Policy;
    policyService.policiesByType$.mockReturnValue(of([policyForOrg1]));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: [] },
    ]);
  });

  it("if one org restricts Card and another has no policy, allowViewOrgIds contains the unrestricted org", async () => {
    policyService.policiesByType$.mockReturnValue(of([policyOrg1]));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: ["org2"] },
    ]);
  });

  it("returns empty allowViewOrgIds when all orgs restrict the same type", async () => {
    organizationService.organizations$.mockReturnValue(of([org1, org2]));
    policyService.policiesByType$.mockReturnValue(of([policyOrg1, policyOrg2]));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: [] },
    ]);
  });

  it("aggregates multiple types and computes allowViewOrgIds correctly", async () => {
    organizationService.organizations$.mockReturnValue(of([org1, org2]));
    policyService.policiesByType$.mockReturnValue(
      of([
        { ...policyOrg1, data: [CipherType.Card, CipherType.Login] } as Policy,
        { ...policyOrg2, data: [CipherType.Card, CipherType.Identity] } as Policy,
      ]),
    );

    const result = await firstValueFrom(service.restricted$);

    expect(result).toEqual<RestrictedCipherType[]>([
      { cipherType: CipherType.Card, allowViewOrgIds: [] },
      { cipherType: CipherType.Login, allowViewOrgIds: ["org2"] },
      { cipherType: CipherType.Identity, allowViewOrgIds: ["org1"] },
    ]);
  });
});
