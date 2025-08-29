import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction as OrganizationApiService } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  BillingApiServiceAbstraction,
  PaymentInformation,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { newGuid } from "@bitwarden/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { OrganizationKeysRequest } from "../../admin-console/models/request/organization-keys.request";
import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { OrgKey } from "../../types/key";

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

  describe("organization key creation methods", () => {
    const mockUserId = newGuid() as UserId;
    const organizationKeys = {
      orgKey: new SymmetricCryptoKey(new Uint8Array(64)) as OrgKey,
      publicKeyEncapsulatedOrgKey: new EncString("encryptedOrgKey"),
      publicKey: "public-key",
      encryptedPrivateKey: new EncString("encryptedPrivateKey"),
    };
    const encryptedCollectionName = new EncString("encryptedCollectionName");
    const mockSubscription = {
      organization: {
        name: "Test Org",
        businessName: "Test Business",
        billingEmail: "test@example.com",
        initiationPath: "Registration form",
      },
      plan: {
        type: 0, // Free plan
        passwordManagerSeats: 0,
        subscribeToSecretsManager: false,
        isFromSecretsManagerTrial: false,
      },
    } as SubscriptionInformation;
    const mockResponse = { id: "org-id" } as OrganizationResponse;

    const expectedRequestObject = {
      name: "Test Org",
      businessName: "Test Business",
      billingEmail: "test@example.com",
      initiationPath: "Registration form",
      planType: 0,
      key: organizationKeys.publicKeyEncapsulatedOrgKey.encryptedString,
      keys: new OrganizationKeysRequest(
        organizationKeys.publicKey,
        organizationKeys.encryptedPrivateKey.encryptedString!,
      ),
      collectionName: encryptedCollectionName.encryptedString,
    };

    beforeEach(() => {
      keyService.makeOrgKey.mockResolvedValue([
        organizationKeys.publicKeyEncapsulatedOrgKey,
        organizationKeys.orgKey,
      ]);
      keyService.makeKeyPair.mockResolvedValue([
        organizationKeys.publicKey,
        organizationKeys.encryptedPrivateKey,
      ]);
      encryptService.encryptString.mockResolvedValueOnce(encryptedCollectionName);
      i18nService.t.mockReturnValue("Default Collection");

      organizationApiService.create.mockResolvedValue(mockResponse);
    });

    describe("purchaseSubscription", () => {
      it("sets the correct organization keys on the organization creation request", async () => {
        const subscriptionWithPayment = {
          ...mockSubscription,
          payment: {
            paymentMethod: ["test-token", PaymentMethodType.Card],
            billing: {
              postalCode: "12345",
              country: "US",
            },
          } as PaymentInformation,
        } as SubscriptionInformation;
        const result = await sut.purchaseSubscription(subscriptionWithPayment, mockUserId);

        expect(keyService.makeOrgKey).toHaveBeenCalledWith(mockUserId);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(organizationKeys.orgKey);
        expect(encryptService.encryptString).toHaveBeenCalledWith(
          "Default Collection",
          organizationKeys.orgKey,
        );
        expect(organizationApiService.create).toHaveBeenCalledWith(
          expect.objectContaining(expectedRequestObject),
        );
        expect(apiService.refreshIdentityToken).toHaveBeenCalled();
        expect(syncService.fullSync).toHaveBeenCalledWith(true);
        expect(result).toBe(mockResponse);
      });
    });

    describe("purchaseSubscriptionNoPaymentMethod", () => {
      it("sets the correct organization keys on the organization creation request", async () => {
        organizationApiService.createWithoutPayment.mockResolvedValue(mockResponse);

        const result = await sut.purchaseSubscriptionNoPaymentMethod(mockSubscription, mockUserId);

        expect(keyService.makeOrgKey).toHaveBeenCalledWith(mockUserId);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(organizationKeys.orgKey);
        expect(encryptService.encryptString).toHaveBeenCalledWith(
          "Default Collection",
          organizationKeys.orgKey,
        );
        expect(organizationApiService.createWithoutPayment).toHaveBeenCalledWith(
          expect.objectContaining(expectedRequestObject),
        );
        expect(apiService.refreshIdentityToken).toHaveBeenCalled();
        expect(syncService.fullSync).toHaveBeenCalledWith(true);
        expect(result).toBe(mockResponse);
      });
    });

    describe("startFree", () => {
      it("sets the correct organization keys on the organization creation request", async () => {
        const result = await sut.startFree(mockSubscription, mockUserId);

        expect(keyService.makeOrgKey).toHaveBeenCalledWith(mockUserId);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(organizationKeys.orgKey);
        expect(encryptService.encryptString).toHaveBeenCalledWith(
          "Default Collection",
          organizationKeys.orgKey,
        );
        expect(organizationApiService.create).toHaveBeenCalledWith(
          expect.objectContaining(expectedRequestObject),
        );
        expect(apiService.refreshIdentityToken).toHaveBeenCalled();
        expect(syncService.fullSync).toHaveBeenCalledWith(true);
        expect(result).toBe(mockResponse);
      });
    });

    describe("restartSubscription", () => {
      it("sets the correct organization keys on the organization creation request", async () => {
        const subscriptionWithPayment = {
          ...mockSubscription,
          payment: {
            paymentMethod: ["test-token", PaymentMethodType.Card],
            billing: {
              postalCode: "12345",
              country: "US",
            },
          } as PaymentInformation,
        } as SubscriptionInformation;

        await sut.restartSubscription("org-id", subscriptionWithPayment, mockUserId);

        expect(keyService.makeOrgKey).toHaveBeenCalledWith(mockUserId);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(organizationKeys.orgKey);
        expect(encryptService.encryptString).toHaveBeenCalledWith(
          "Default Collection",
          organizationKeys.orgKey,
        );
        expect(billingApiService.restartSubscription).toHaveBeenCalledWith(
          "org-id",
          expect.objectContaining(expectedRequestObject),
        );
      });
    });
  });
});
