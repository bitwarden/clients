import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { ProviderAddOrganizationRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-add-organization.request";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billilng-api.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { CreateClientOrganizationRequest } from "@bitwarden/common/billing/models/request/create-client-organization.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

@Injectable()
export class WebProviderService {
  constructor(
    private cryptoService: CryptoService,
    private syncService: SyncService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private billingApiService: BillingApiServiceAbstraction,
  ) {}

  async addOrganizationToProvider(providerId: string, organizationId: string) {
    const orgKey = await this.cryptoService.getOrgKey(organizationId);
    const providerKey = await this.cryptoService.getProviderKey(providerId);

    const encryptedOrgKey = await this.cryptoService.encrypt(orgKey.key, providerKey);

    const request = new ProviderAddOrganizationRequest();
    request.organizationId = organizationId;
    request.key = encryptedOrgKey.encryptedString;

    const response = await this.apiService.postProviderAddOrganization(providerId, request);
    await this.syncService.fullSync(true);
    return response;
  }

  async createClientOrganization(
    providerId: string,
    name: string,
    ownerEmail: string,
    planType: PlanType,
    seats: number,
  ): Promise<void> {
    const organizationKey = (await this.cryptoService.makeOrgKey<OrgKey>())[1];

    const [publicKey, encryptedPrivateKey] = await this.cryptoService.makeKeyPair(organizationKey);

    const encryptedCollectionName = await this.encryptService.encrypt(
      this.i18nService.t("defaultCollection"),
      organizationKey,
    );

    const providerKey = await this.cryptoService.getProviderKey(providerId);

    const encryptedProviderKey = await this.encryptService.encrypt(
      organizationKey.key,
      providerKey,
    );

    const request = new CreateClientOrganizationRequest();
    request.name = name;
    request.ownerEmail = ownerEmail;
    request.planType = planType;
    request.seats = seats;

    request.key = encryptedProviderKey.encryptedString;
    request.keyPair = new OrganizationKeysRequest(publicKey, encryptedPrivateKey.encryptedString);
    request.collectionName = encryptedCollectionName.encryptedString;

    await this.billingApiService.createProviderClientOrganization(providerId, request);

    await this.apiService.refreshIdentityToken();

    await this.syncService.fullSync(true);
  }

  async detachOrganization(providerId: string, organizationId: string): Promise<any> {
    await this.apiService.deleteProviderOrganization(providerId, organizationId);
    await this.syncService.fullSync(true);
  }
}
