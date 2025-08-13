import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction as OrganizationApiService } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

describe("BillingAccountProfileStateService", () => {
  let apiService: jest.Mocked<ApiService>;
  let billingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let i18nService: jest.Mocked<I18nService>;
  let organizationApiService: jest.Mocked<OrganizationApiService>;
  let syncService: jest.Mocked<SyncService>;
  let configService: jest.Mocked<ConfigService>;

  let sut: OrganizationBillingService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    billingApiService = mock<BillingApiServiceAbstraction>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    organizationApiService = mock<OrganizationApiService>();
    syncService = mock<SyncService>();
    configService = mock<ConfigService>();

    sut = new OrganizationBillingService(
      apiService,
      billingApiService,
      keyService,
      encryptService,
      i18nService,
      organizationApiService,
      syncService,
      configService,
    );
  });

  afterEach(() => {
    return jest.resetAllMocks();
  });

  describe("isBreadcrumbingPoliciesEnabled", () => {
    it("returns false when feature flag is disabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const org = {
        isProviderUser: false,
        canEditSubscription: true,
        productTierType: ProductTierType.Teams,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(false);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM12276_BreadcrumbEventLogs,
      );
    });

    it("returns false when organization belongs to a provider", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const org = {
        isProviderUser: true,
        canEditSubscription: true,
        productTierType: ProductTierType.Teams,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(false);
    });

    it("returns false when cannot edit subscription", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const org = {
        isProviderUser: false,
        canEditSubscription: false,
        productTierType: ProductTierType.Teams,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(false);
    });

    it.each([
      ["Teams", ProductTierType.Teams],
      ["TeamsStarter", ProductTierType.TeamsStarter],
    ])("returns true when all conditions are met with %s tier", async (_, productTierType) => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const org = {
        isProviderUser: false,
        canEditSubscription: true,
        productTierType: productTierType,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(true);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM12276_BreadcrumbEventLogs,
      );
    });

    it("returns false when product tier is not supported", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const org = {
        isProviderUser: false,
        canEditSubscription: true,
        productTierType: ProductTierType.Enterprise,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(false);
    });

    it("handles all conditions false correctly", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const org = {
        isProviderUser: true,
        canEditSubscription: false,
        productTierType: ProductTierType.Free,
      } as Organization;

      const actual = await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(actual).toBe(false);
    });

    it("verifies feature flag is only called once", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const org = {
        isProviderUser: false,
        canEditSubscription: true,
        productTierType: ProductTierType.Teams,
      } as Organization;

      await firstValueFrom(sut.isBreadcrumbingPoliciesEnabled$(org));
      expect(configService.getFeatureFlag$).toHaveBeenCalledTimes(1);
    });
  });
});
