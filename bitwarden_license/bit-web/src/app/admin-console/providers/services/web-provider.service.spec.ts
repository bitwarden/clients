import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { PlanType } from "@bitwarden/common/billing/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrgKey, ProviderKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { WebProviderService } from "./web-provider.service";

describe("WebProviderService", () => {
  let sut: WebProviderService;
  let keyService: MockProxy<KeyService>;
  let syncService: MockProxy<SyncService>;
  let apiService: MockProxy<ApiService>;
  let i18nService: MockProxy<I18nService>;
  let encryptService: MockProxy<EncryptService>;
  let providerApiService: MockProxy<ProviderApiServiceAbstraction>;

  const activeUserId = newGuid() as UserId;
  const providerId = "provider-123";
  const mockOrgKey = new SymmetricCryptoKey(new Uint8Array(64)) as OrgKey;
  const mockProviderKey = new SymmetricCryptoKey(new Uint8Array(64)) as ProviderKey;
  const mockProviderKeysById: Record<string, ProviderKey> = {
    [providerId]: mockProviderKey,
  };

  beforeEach(() => {
    keyService = mock();
    syncService = mock();
    apiService = mock();
    i18nService = mock();
    encryptService = mock();
    providerApiService = mock();

    sut = new WebProviderService(
      keyService,
      syncService,
      apiService,
      i18nService,
      encryptService,
      providerApiService,
    );
  });

  describe("addOrganizationToProvider", () => {
    const organizationId = "org-789";
    const encryptedOrgKey = new EncString("encrypted-org-key");
    const mockOrgKeysById: Record<string, OrgKey> = {
      [organizationId]: mockOrgKey,
    };

    beforeEach(() => {
      keyService.orgKeys$.mockReturnValue(of(mockOrgKeysById));
      keyService.providerKeys$.mockReturnValue(of(mockProviderKeysById));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedOrgKey);
    });

    it("adds an organization to a provider with correct encryption", async () => {
      await sut.addOrganizationToProvider(providerId, organizationId, activeUserId);

      expect(keyService.orgKeys$).toHaveBeenCalledWith(activeUserId);
      expect(keyService.providerKeys$).toHaveBeenCalledWith(activeUserId);
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockOrgKey, mockProviderKey);
      expect(providerApiService.addOrganizationToProvider).toHaveBeenCalledWith(providerId, {
        key: encryptedOrgKey.encryptedString,
        organizationId,
      });
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("throws an error if organization key is not found", async () => {
      const invalidOrgId = "invalid-org";

      await expect(
        sut.addOrganizationToProvider(providerId, invalidOrgId, activeUserId),
      ).rejects.toThrow("Organization key not found");
    });

    it("throws an error if no organization keys are available", async () => {
      keyService.orgKeys$.mockReturnValue(of(null));

      await expect(
        sut.addOrganizationToProvider(providerId, organizationId, activeUserId),
      ).rejects.toThrow("Organization key not found");
    });

    it("throws an error if provider key is not found", async () => {
      const invalidProviderId = "invalid-provider";
      await expect(
        sut.addOrganizationToProvider(invalidProviderId, organizationId, activeUserId),
      ).rejects.toThrow("Provider key not found");
    });

    it("throws an error if no provider keys are available", async () => {
      keyService.providerKeys$.mockReturnValue(of(null));

      await expect(
        sut.addOrganizationToProvider(providerId, organizationId, activeUserId),
      ).rejects.toThrow("Provider key not found");
    });
  });

  describe("createClientOrganization", () => {
    const name = "Test Org";
    const ownerEmail = "owner@example.com";
    const planType = PlanType.EnterpriseAnnually;
    const seats = 10;
    const publicKey = "public-key";
    const encryptedPrivateKey = new EncString("encrypted-private-key");
    const encryptedProviderKey = new EncString("encrypted-provider-key");
    const encryptedCollectionName = new EncString("encrypted-collection-name");
    const defaultCollectionTranslation = "Default Collection";

    beforeEach(() => {
      keyService.makeOrgKey.mockResolvedValue([new EncString("mockEncryptedKey"), mockOrgKey]);
      keyService.makeKeyPair.mockResolvedValue([publicKey, encryptedPrivateKey]);
      i18nService.t.mockReturnValue(defaultCollectionTranslation);
      encryptService.encryptString.mockResolvedValue(encryptedCollectionName);
      keyService.providerKeys$.mockReturnValue(of(mockProviderKeysById));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedProviderKey);
    });

    it("creates a client organization and calls all dependencies with correct arguments", async () => {
      await sut.createClientOrganization(
        providerId,
        name,
        ownerEmail,
        planType,
        seats,
        activeUserId,
      );

      expect(keyService.makeOrgKey).toHaveBeenCalledWith(activeUserId);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockOrgKey);
      expect(i18nService.t).toHaveBeenCalledWith("defaultCollection");
      expect(encryptService.encryptString).toHaveBeenCalledWith(
        defaultCollectionTranslation,
        mockOrgKey,
      );
      expect(keyService.providerKeys$).toHaveBeenCalledWith(activeUserId);
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockOrgKey, mockProviderKey);

      expect(providerApiService.createProviderOrganization).toHaveBeenCalledWith(
        providerId,
        expect.objectContaining({
          name,
          ownerEmail,
          planType,
          seats,
          key: encryptedProviderKey.encryptedString,
          keyPair: expect.any(OrganizationKeysRequest),
          collectionName: encryptedCollectionName.encryptedString,
        }),
      );

      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("throws an error if provider key is not found", async () => {
      const invalidProviderId = "invalid-provider";
      await expect(
        sut.createClientOrganization(
          invalidProviderId,
          name,
          ownerEmail,
          planType,
          seats,
          activeUserId,
        ),
      ).rejects.toThrow("Provider key not found");
    });

    it("throws an error if no provider keys are available", async () => {
      keyService.providerKeys$.mockReturnValue(of(null));

      await expect(
        sut.createClientOrganization(providerId, name, ownerEmail, planType, seats, activeUserId),
      ).rejects.toThrow("Provider key not found");
    });
  });
});
