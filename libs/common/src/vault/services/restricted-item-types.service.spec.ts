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

import { CipherLike } from "../types/cipher-like";

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

    service = new RestrictedItemTypesService(accountService, organizationService, policyService);
  });

  it("emits empty array when feature flag is disabled", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const result = await firstValueFrom(service.restricted$);
    expect(result).toEqual([]);
  });

  it("emits empty array if no account is active", async () => {
    accountService.activeAccount$ = of(null);

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

  describe("isCipherRestricted", () => {
    it("returns false when cipher type is not in restricted types", () => {
      const cipher: CipherLike = {
        type: CipherType.Login,
        organizationId: "Pete the Cat",
      } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns false when restricted types array is empty", () => {
      const cipher: CipherLike = { type: CipherType.Card, organizationId: "org1" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns false when cipher type does not match any restricted types", () => {
      const cipher: CipherLike = {
        type: CipherType.SecureNote,
        organizationId: "org1",
      } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
        { cipherType: CipherType.Login, allowViewOrgIds: [] },
        { cipherType: CipherType.Identity, allowViewOrgIds: [] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns true for personal cipher when type is restricted", () => {
      const cipher: CipherLike = { type: CipherType.Card, organizationId: null } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: ["org1"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });

    it("returns true for personal cipher with undefined organizationId when type is restricted", () => {
      const cipher: CipherLike = {
        type: CipherType.Login,
        organizationId: undefined,
      } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Login, allowViewOrgIds: ["org1", "org2"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });

    it("returns true for personal cipher regardless of allowViewOrgIds content", () => {
      const cipher: CipherLike = { type: CipherType.Identity, organizationId: null } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Identity, allowViewOrgIds: [] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });

    it("returns false when organization is in allowViewOrgIds", () => {
      const cipher: CipherLike = { type: CipherType.Card, organizationId: "org1" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: ["org1"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns false when organization is among multiple allowViewOrgIds", () => {
      const cipher: CipherLike = { type: CipherType.Login, organizationId: "org2" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Login, allowViewOrgIds: ["org1", "org2", "org3"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns false when type is restricted globally but cipher org allows it", () => {
      const cipher: CipherLike = { type: CipherType.Card, organizationId: "org2" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: ["org2"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(false);
    });

    it("returns true when organization is not in allowViewOrgIds", () => {
      const cipher: CipherLike = { type: CipherType.Card, organizationId: "org3" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Card, allowViewOrgIds: ["org1", "org2"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });

    it("returns true when allowViewOrgIds is empty for org cipher", () => {
      const cipher: CipherLike = { type: CipherType.Login, organizationId: "org1" } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Login, allowViewOrgIds: [] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });

    it("returns true when cipher org differs from all allowViewOrgIds", () => {
      const cipher: CipherLike = {
        type: CipherType.Identity,
        organizationId: "org5",
      } as CipherLike;
      const restrictedTypes: RestrictedCipherType[] = [
        { cipherType: CipherType.Identity, allowViewOrgIds: ["org1", "org2", "org3", "org4"] },
      ];

      const result = service.isCipherRestricted(cipher, restrictedTypes);

      expect(result).toBe(true);
    });
  });

  describe("isCipherRestricted$", () => {
    it("returns true when cipher is restricted by policy", async () => {
      policyService.policiesByType$.mockReturnValue(of([policyOrg1]));
      const cipher: CipherLike = { type: CipherType.Card, organizationId: null } as CipherLike;

      const result = await firstValueFrom(service.isCipherRestricted$(cipher));

      expect(result).toBe(true);
    });

    it("returns false when cipher is not restricted", async () => {
      policyService.policiesByType$.mockReturnValue(of([policyOrg1]));
      const cipher: CipherLike = { type: CipherType.Login, organizationId: "org2" } as CipherLike;

      const result = await firstValueFrom(service.isCipherRestricted$(cipher));

      expect(result).toBe(false);
    });
  });
});
