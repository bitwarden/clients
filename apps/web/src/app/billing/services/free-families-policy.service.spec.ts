import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { FreeFamiliesPolicyService } from "./free-families-policy.service";

describe("FreeFamiliesPolicyService", () => {
  let service: FreeFamiliesPolicyService;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let govModeService: MockProxy<GovModeService>;
  let accountService: FakeAccountService;
  const userId = Utils.newGuid() as UserId;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    govModeService = mock<GovModeService>();
    govModeService.isGovMode$.mockReturnValue(of(false));
    accountService = mockAccountServiceWith(userId);

    service = new FreeFamiliesPolicyService(
      policyService,
      organizationService,
      accountService,
      govModeService,
    );
  });

  describe("showSponsoredFamiliesDropdown$", () => {
    it("should return true when all conditions are met", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization that meets all criteria
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: true,
        isOwner: false,
        canManageUsers: false,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(true);
    });

    it("should return false when organization is not Enterprise", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization that is not Enterprise tier
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Teams,
        useAdminSponsoredFamilies: true,
        isAdmin: true,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(false);
    });

    it("should return false when families feature is disabled by policy", async () => {
      // Configure mocks with a policy that disables the feature
      policyService.policiesByType$.mockReturnValue(
        of([{ organizationId: "org-id", enabled: true } as Policy]),
      );

      // Create a test organization
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: true,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(false);
    });

    it("should return false when useAdminSponsoredFamilies is false", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization with useAdminSponsoredFamilies set to false
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: false,
        isAdmin: true,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(false);
    });

    it("should return true when user is an owner but not admin", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization where user is owner but not admin
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: false,
        isOwner: true,
        canManageUsers: false,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(true);
    });

    it("should return true when user can manage users but is not admin or owner", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization where user can manage users but is not admin or owner
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: false,
        isOwner: false,
        canManageUsers: true,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(true);
    });

    it("should return false when user has no admin permissions", async () => {
      // Configure mocks
      policyService.policiesByType$.mockReturnValue(of([]));

      // Create a test organization where user has no admin permissions
      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: false,
        isOwner: false,
        canManageUsers: false,
      } as Organization;

      // Test the method
      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(false);
    });

    it("should return false in gov mode", async () => {
      policyService.policiesByType$.mockReturnValue(of([]));
      govModeService.isGovMode$.mockReturnValue(of(true));

      const organization = {
        id: "org-id",
        productTierType: ProductTierType.Enterprise,
        useAdminSponsoredFamilies: true,
        isAdmin: true,
        isOwner: false,
        canManageUsers: false,
      } as Organization;

      const result = await firstValueFrom(service.showSponsoredFamiliesDropdown$(of(organization)));
      expect(result).toBe(false);
    });
  });

  describe("showFreeFamilies$", () => {
    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([]));
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-id", canManageSponsorships: true } as Organization]),
      );
    });

    it("should return true when the user can manage sponsorships outside gov mode", async () => {
      const result = await firstValueFrom(service.showFreeFamilies$);
      expect(result).toBe(true);
    });

    it("should return false in gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));

      const result = await firstValueFrom(service.showFreeFamilies$);
      expect(result).toBe(false);
    });
  });
});
