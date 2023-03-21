import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { ProviderAddOrganizationRequest } from "@bitwarden/common/models/request/provider/provider-add-organization.request";
import { Guid } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

@Injectable()
export class WebProviderService {
  constructor(
    private cryptoService: CryptoService,
    private syncService: SyncService,
    private apiService: ApiService
  ) {}

  async addOrganizationToProvider(providerId: Guid, organizationId: Guid) {
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

  async detachOrganizastion(providerId: string, organizationId: string): Promise<any> {
    await this.apiService.deleteProviderOrganization(providerId, organizationId);
    await this.syncService.fullSync(true);
  }
}
