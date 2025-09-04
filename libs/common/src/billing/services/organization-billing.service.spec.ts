import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction as OrganizationApiService } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  BillingApiServiceAbstraction,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { OrgKey } from "../../types/key";
import { PaymentMethodResponse } from "../models/response/payment-method.response";

describe("OrganizationBillingService", () => {
  let apiService: jest.Mocked<ApiService>;
  let billingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let i18nService: jest.Mocked<I18nService>;
  let organizationApiService: jest.Mocked<OrganizationApiService>;
  let syncService: jest.Mocked<SyncService>;

  let sut: OrganizationBillingService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    billingApiService = mock<BillingApiServiceAbstraction>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    organizationApiService = mock<OrganizationApiService>();
    syncService = mock<SyncService>();

    sut = new OrganizationBillingService(
      apiService,
      billingApiService,
      keyService,
      encryptService,
      i18nService,
      organizationApiService,
      syncService,
    );
  });

  afterEach(() => {
    return jest.resetAllMocks();
  });

  describe("getPaymentSource()", () => {
    it("given a valid organization id, then it returns a payment source", async () => {
      //Arrange
      const orgId = "organization-test";
      const paymentMethodResponse = {
        paymentSource: { type: PaymentMethodType.Card },
      } as PaymentMethodResponse;
      billingApiService.getOrganizationPaymentMethod.mockResolvedValue(paymentMethodResponse);

      //Act
      const returnedPaymentSource = await sut.getPaymentSource(orgId);

      //Assert
      expect(billingApiService.getOrganizationPaymentMethod).toHaveBeenCalledTimes(1);
      expect(returnedPaymentSource).toEqual(paymentMethodResponse.paymentSource);
    });

    it("given an invalid organizationId, it should return undefined", async () => {
      //Arrange
      const orgId = "invalid-id";
      billingApiService.getOrganizationPaymentMethod.mockResolvedValue(null);

      //Act
      const returnedPaymentSource = await sut.getPaymentSource(orgId);

      //Assert
      expect(billingApiService.getOrganizationPaymentMethod).toHaveBeenCalledTimes(1);
      expect(returnedPaymentSource).toBeUndefined();
    });

    it("given an API error occurs, then it throws the error", async () => {
      // Arrange
      const orgId = "error-org";
      billingApiService.getOrganizationPaymentMethod.mockRejectedValue(new Error("API Error"));

      // Act & Assert
      await expect(sut.getPaymentSource(orgId)).rejects.toThrow("API Error");
      expect(billingApiService.getOrganizationPaymentMethod).toHaveBeenCalledTimes(1);
    });
  });

  describe("purchaseSubscription()", () => {
    it("given valid subscription information, then it returns successful response", async () => {
      //Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
        payment: {
          paymentMethod: ["card-token", PaymentMethodType.Card],
          billing: { postalCode: "12345" },
        },
      } as SubscriptionInformation;

      const organizationResponse = {
        name: subscriptionInformation.organization.name,
        billingEmail: subscriptionInformation.organization.billingEmail,
        planType: subscriptionInformation.plan.type,
      } as OrganizationResponse;

      organizationApiService.create.mockResolvedValue(organizationResponse);
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypyted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypyted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypyted"));

      //Act
      const response = await sut.purchaseSubscription(subscriptionInformation);

      //Assert
      expect(organizationApiService.create).toHaveBeenCalledTimes(1);
      expect(response).toEqual(organizationResponse);
    });

    it("given organization creation fails, then it throws an error", async () => {
      // Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
        payment: {
          paymentMethod: ["card-token", PaymentMethodType.Card],
          billing: { postalCode: "12345" },
        },
      } as SubscriptionInformation;

      organizationApiService.create.mockRejectedValue(new Error("Failed to create organization"));
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypyted"));

      // Act & Assert
      await expect(sut.purchaseSubscription(subscriptionInformation)).rejects.toThrow(
        "Failed to create organization",
      );
    });

    it("given key generation fails, then it throws an error", async () => {
      // Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
        payment: {
          paymentMethod: ["card-token", PaymentMethodType.Card],
          billing: { postalCode: "12345" },
        },
      } as SubscriptionInformation;

      keyService.makeOrgKey.mockRejectedValue(new Error("Key generation failed"));

      // Act & Assert
      await expect(sut.purchaseSubscription(subscriptionInformation)).rejects.toThrow(
        "Key generation failed",
      );
    });

    it("given an invalid plan type, then it throws an error", async () => {
      // Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: -1 as unknown as PlanType },
        payment: {
          paymentMethod: ["card-token", PaymentMethodType.Card],
          billing: { postalCode: "12345" },
        },
      } as SubscriptionInformation;

      // Act & Assert
      await expect(sut.purchaseSubscription(subscriptionInformation)).rejects.toThrow();
    });
  });

  describe("purchaseSubscriptionNoPaymentMethod()", () => {
    it("given valid subscription information, then it returns successful response", async () => {
      //Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
      } as SubscriptionInformation;

      const organizationResponse = {
        name: subscriptionInformation.organization.name,
        plan: { type: subscriptionInformation.plan.type },
        planType: subscriptionInformation.plan.type,
      } as OrganizationResponse;

      organizationApiService.createWithoutPayment.mockResolvedValue(organizationResponse);
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypted"));

      //Act
      const response = await sut.purchaseSubscriptionNoPaymentMethod(subscriptionInformation);

      //Assert
      expect(organizationApiService.createWithoutPayment).toHaveBeenCalledTimes(1);
      expect(response).toEqual(organizationResponse);
    });

    it("given organization creation fails without payment method, then it throws an error", async () => {
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
      } as SubscriptionInformation;

      organizationApiService.createWithoutPayment.mockRejectedValue(new Error("Creation failed"));
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypted"));

      await expect(
        sut.purchaseSubscriptionNoPaymentMethod(subscriptionInformation),
      ).rejects.toThrow("Creation failed");
    });

    it("given key generation fails, then it throws an error", async () => {
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.EnterpriseAnnually2023 },
      } as SubscriptionInformation;

      keyService.makeOrgKey.mockRejectedValue(new Error("Key generation failed"));
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);

      await expect(
        sut.purchaseSubscriptionNoPaymentMethod(subscriptionInformation),
      ).rejects.toThrow("Key generation failed");
    });
  });

  describe("startFree()", () => {
    it("given valid free plan information, then it creates a free organization", async () => {
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.Free },
      } as SubscriptionInformation;

      const organizationResponse = {
        name: subscriptionInformation.organization.name,
        billingEmail: subscriptionInformation.organization.billingEmail,
        planType: subscriptionInformation.plan.type,
      } as OrganizationResponse;

      organizationApiService.create.mockResolvedValue(organizationResponse);
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypyted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypyted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypyted"));

      //Act
      const response = await sut.startFree(subscriptionInformation);

      //Assert
      expect(organizationApiService.create).toHaveBeenCalledTimes(1);
      expect(response).toEqual(organizationResponse);
    });

    it("given key generation fails, then it throws an error", async () => {
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.Free },
      } as SubscriptionInformation;

      keyService.makeOrgKey.mockRejectedValue(new Error("Key generation failed"));
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);

      await expect(sut.startFree(subscriptionInformation)).rejects.toThrow("Key generation failed");
    });

    it("given organization creation fails, then it throws an error", async () => {
      // Arrange
      const subscriptionInformation = {
        organization: { name: "test-business", billingEmail: "test@test.com" },
        plan: { type: PlanType.Free },
      } as SubscriptionInformation;

      organizationApiService.create.mockRejectedValue(new Error("Failed to create organization"));
      keyService.makeOrgKey.mockResolvedValue([new EncString("encrypted-key"), {} as OrgKey]);
      keyService.makeKeyPair.mockResolvedValue(["key", new EncString("encrypted-key")]);
      encryptService.encryptString.mockResolvedValue(new EncString("collection-encrypyted"));
      // Act & Assert
      await expect(sut.startFree(subscriptionInformation)).rejects.toThrow(
        "Failed to create organization",
      );
    });
  });
});
