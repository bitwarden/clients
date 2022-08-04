import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider-api.service.abstraction";
import { ProviderSetupRequest } from "@bitwarden/common/models/request/provider/providerSetupRequest";
import { ProviderUpdateRequest } from "@bitwarden/common/models/request/provider/providerUpdateRequest";
import { ProviderResponse } from "@bitwarden/common/models/response/provider/providerResponse";

export class ProviderApiService implements ProviderApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async update(id: string, updateRequest: ProviderUpdateRequest): Promise<ProviderResponse> {
    const r = await this.apiService.send("PUT", "/providers/" + id, updateRequest, true, true);
    return new ProviderResponse(r);
  }

  async setup(id: string, setupRequest: ProviderSetupRequest): Promise<ProviderResponse> {
    const r = await this.apiService.send(
      "POST",
      "/providers/" + id + "/setup",
      setupRequest,
      true,
      true
    );
    return new ProviderResponse(r);
  }

  async get(id: string): Promise<ProviderResponse> {
    const r = await this.apiService.send("GET", "/providers/" + id, null, true, true);
    return new ProviderResponse(r);
  }
}
