import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedCipherType } from "@bitwarden/vault";

import { CliRestrictedItemTypesService } from "./cli-restricted-item-types.service";

describe("CliRestrictedItemTypesService", () => {
  let service: CliRestrictedItemTypesService;
  let configService: MockProxy<ConfigService>;
  let organizationService: MockProxy<OrganizationService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let logService: MockProxy<LogService>;

  const userId = "userId" as UserId;
  const org1: Organization = { id: "org1", name: "Organization 1" } as Organization;
  const org2: Organization = { id: "org2", name: "Organization 2" } as Organization;

  const createPolicyResponse = (
    orgId: string,
    enabled: boolean,
    data?: CipherType[],
  ): PolicyResponse =>
    ({
      id: Utils.newGuid(),
      organizationId: orgId,
      type: PolicyType.RestrictedItemTypes,
      enabled,
      data: data ?? [CipherType.Card],
    }) as PolicyResponse;

  beforeEach(() => {
    configService = mock<ConfigService>();
    organizationService = mock<OrganizationService>();
    policyApiService = mock<PolicyApiServiceAbstraction>();
    logService = mock<LogService>();

    service = new CliRestrictedItemTypesService(
      configService,
      organizationService,
      policyApiService,
      logService,
    );

    configService.getFeatureFlag.mockResolvedValue(true);
    organizationService.organizations$.mockReturnValue(of([org1, org2]));
    policyApiService.getPolicy.mockRejectedValue(new Error("Policy not found"));
  });

  describe("getRestrictedTypes", () => {
    it("returns empty array when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual([]);
      expect(organizationService.organizations$).not.toHaveBeenCalled();
    });

    it("returns empty array if no organizations exist", async () => {
      organizationService.organizations$.mockReturnValue(of([]));

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual([]);
    });

    it("returns empty array if no policies are enabled", async () => {
      policyApiService.getPolicy.mockResolvedValue(createPolicyResponse("org1", false));

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual([]);
    });

    it("defaults undefined data to [Card] and returns empty allowViewOrgIds", async () => {
      organizationService.organizations$.mockReturnValue(of([org1]));
      policyApiService.getPolicy.mockResolvedValue(createPolicyResponse("org1", true, undefined));

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual<RestrictedCipherType[]>([
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
      ]);
    });

    it("if one org restricts Card and another has no policy, allowViewOrgIds contains the unrestricted org", async () => {
      policyApiService.getPolicy.mockImplementation(async (orgId) => {
        if (orgId === "org1") {
          return createPolicyResponse("org1", true, [CipherType.Card]);
        }
        throw new Error("Policy not found"); // org2 has no policy
      });

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual<RestrictedCipherType[]>([
        { cipherType: CipherType.Card, allowViewOrgIds: ["org2"] },
      ]);
    });

    it("returns empty allowViewOrgIds when all orgs restrict the same type", async () => {
      policyApiService.getPolicy.mockImplementation(async (orgId) => {
        return createPolicyResponse(orgId, true, [CipherType.Card]);
      });

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual<RestrictedCipherType[]>([
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
      ]);
    });

    it("aggregates multiple types and computes allowViewOrgIds correctly", async () => {
      policyApiService.getPolicy.mockImplementation(async (orgId) => {
        if (orgId === "org1") {
          return createPolicyResponse("org1", true, [CipherType.Card, CipherType.Login]);
        }
        if (orgId === "org2") {
          return createPolicyResponse("org2", true, [CipherType.Card, CipherType.Identity]);
        }
        throw new Error("Policy not found");
      });

      const result = await service.getRestrictedTypes(userId);

      expect(result).toEqual<RestrictedCipherType[]>([
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
        { cipherType: CipherType.Login, allowViewOrgIds: ["org2"] },
        { cipherType: CipherType.Identity, allowViewOrgIds: ["org1"] },
      ]);
    });
  });

  describe("filterRestrictedCiphers", () => {
    const cardCipher: CipherView = {
      id: "cipher1",
      type: CipherType.Card,
      organizationId: "org1",
    } as CipherView;

    const loginCipher: CipherView = {
      id: "cipher2",
      type: CipherType.Login,
      organizationId: "org1",
    } as CipherView;

    const identityCipher: CipherView = {
      id: "cipher3",
      type: CipherType.Identity,
      organizationId: "org2",
    } as CipherView;

    beforeEach(() => {
      policyApiService.getPolicy.mockImplementation(async (orgId) => {
        if (orgId === "org1") {
          return createPolicyResponse("org1", true, [CipherType.Card]);
        }
        throw new Error("Policy not found");
      });
    });

    it("filters out restricted cipher types from array", async () => {
      const ciphers = [cardCipher, loginCipher, identityCipher];

      const result = await service.filterRestrictedCiphers(ciphers, userId);

      expect(result).toEqual([loginCipher, identityCipher]);
    });

    it("returns null for single restricted cipher", async () => {
      const result = await service.filterRestrictedCiphers(cardCipher, userId);

      expect(result).toBeNull();
    });

    it("returns cipher for single non-restricted cipher", async () => {
      const result = await service.filterRestrictedCiphers(loginCipher, userId);

      expect(result).toEqual(loginCipher);
    });

    it("returns empty array when all ciphers are restricted", async () => {
      policyApiService.getPolicy.mockImplementation(async (orgId) => {
        return createPolicyResponse(orgId, true, [
          CipherType.Card,
          CipherType.Login,
          CipherType.Identity,
        ]);
      });

      const ciphers = [cardCipher, loginCipher, identityCipher];
      const result = await service.filterRestrictedCiphers(ciphers, userId);

      expect(result).toEqual([]);
    });

    it("returns all ciphers when no restrictions exist", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      const ciphers = [cardCipher, loginCipher, identityCipher];
      const result = await service.filterRestrictedCiphers(ciphers, userId);

      expect(result).toEqual(ciphers);
    });

    it("handles empty cipher array", async () => {
      const result = await service.filterRestrictedCiphers([], userId);

      expect(result).toEqual([]);
    });
  });
});
