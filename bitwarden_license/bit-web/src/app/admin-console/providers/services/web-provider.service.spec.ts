import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "@bitwarden/common/platform/state";
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
  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let stateProvider: MockProxy<StateProvider>;
  let providerApiService: MockProxy<ProviderApiServiceAbstraction>;
  let accountService: MockProxy<AccountService>;

  beforeEach(() => {
    keyService = mock();
    syncService = mock();
    apiService = mock();
    i18nService = mock();
    encryptService = mock();
    billingApiService = mock();
    stateProvider = mock();
    providerApiService = mock();
    accountService = mock();

    sut = new WebProviderService(
      keyService,
      syncService,
      apiService,
      i18nService,
      encryptService,
      billingApiService,
      stateProvider,
      providerApiService,
      accountService,
    );
  });

  describe("createClientOrganization", () => {
    const activeUserId = newGuid() as UserId;
    const providerId = "provider-123";
    const name = "Test Org";
    const ownerEmail = "owner@example.com";
    const planType = PlanType.EnterpriseAnnually;
    const seats = 10;
    const publicKey = "public-key";
    const encryptedPrivateKey = new EncString("encrypted-private-key");
    const encryptedProviderKey = new EncString("encrypted-provider-key");
    const encryptedCollectionName = new EncString("encrypted-collection-name");
    const defaultCollectionTranslation = "Default Collection";
    const mockOrgKey = new SymmetricCryptoKey(new Uint8Array(64)) as OrgKey;
    const mockProviderKey = new SymmetricCryptoKey(new Uint8Array(64)) as ProviderKey;

    beforeEach(() => {
      keyService.makeOrgKey.mockResolvedValue([new EncString("mockEncryptedKey"), mockOrgKey]);
      keyService.makeKeyPair.mockResolvedValue([publicKey, encryptedPrivateKey]);
      i18nService.t.mockReturnValue(defaultCollectionTranslation);
      encryptService.encryptString.mockResolvedValue(encryptedCollectionName);
      keyService.getProviderKey.mockResolvedValue(mockProviderKey);
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
      expect(keyService.getProviderKey).toHaveBeenCalledWith(providerId);
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockOrgKey, mockProviderKey);

      expect(billingApiService.createProviderClientOrganization).toHaveBeenCalledWith(
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
  });
});
