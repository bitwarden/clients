import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { HealthAccessService } from "./health-access.service";

describe("HealthAccessService", () => {
  const userId = Utils.newGuid() as UserId;

  const freeOrganization = { productTierType: ProductTierType.Free } as Organization;
  const familiesOrganization = { productTierType: ProductTierType.Families } as Organization;
  const teamsOrganization = { productTierType: ProductTierType.Teams } as Organization;
  const teamsStarterOrganization = {
    productTierType: ProductTierType.TeamsStarter,
  } as Organization;
  const enterpriseOrganization = { productTierType: ProductTierType.Enterprise } as Organization;

  let configService: MockProxy<ConfigService>;
  let organizationService: MockProxy<OrganizationService>;
  let service: HealthAccessService;

  function setFeatureFlag(enabled: boolean) {
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.BrowserExtensionHealthReport)
      .mockReturnValue(of(enabled));
  }

  function setOrganizations(organizations: Organization[]) {
    organizationService.organizations$.calledWith(userId).mockReturnValue(of(organizations));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    organizationService = mock<OrganizationService>();

    TestBed.configureTestingModule({
      providers: [
        HealthAccessService,
        { provide: ConfigService, useValue: configService },
        { provide: OrganizationService, useValue: organizationService },
      ],
    });

    service = TestBed.inject(HealthAccessService);
  });

  describe("when the feature flag is off", () => {
    it("is disabled for a personal account", async () => {
      setFeatureFlag(false);
      setOrganizations([]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });

    it("is disabled for a free organization member", async () => {
      setFeatureFlag(false);
      setOrganizations([freeOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });

    it("is disabled for a families organization member", async () => {
      setFeatureFlag(false);
      setOrganizations([familiesOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });
  });

  describe("when the feature flag is on", () => {
    beforeEach(() => {
      setFeatureFlag(true);
    });

    it("is enabled for a personal account", async () => {
      setOrganizations([]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(true);
    });

    it("is enabled for a free organization member", async () => {
      setOrganizations([freeOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(true);
    });

    it("is enabled for a families organization member", async () => {
      setOrganizations([familiesOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(true);
    });

    it("is enabled for a member of both a free and a families organization", async () => {
      setOrganizations([freeOrganization, familiesOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(true);
    });

    it("is disabled for a teams organization member", async () => {
      setOrganizations([teamsOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });

    it("is disabled for a teams starter organization member", async () => {
      setOrganizations([teamsStarterOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });

    it("is disabled for an enterprise organization member", async () => {
      setOrganizations([enterpriseOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });

    it("is disabled for a member of both a free and an enterprise organization", async () => {
      setOrganizations([freeOrganization, enterpriseOrganization]);

      const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

      expect(healthEnabled).toBe(false);
    });
  });
});
