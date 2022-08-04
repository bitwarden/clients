import { ProviderSetupRequest } from "@bitwarden/common/models/request/provider/providerSetupRequest";
import { ProviderUpdateRequest } from "@bitwarden/common/models/request/provider/providerUpdateRequest";
import { ProviderResponse } from "@bitwarden/common/models/response/provider/providerResponse";

export abstract class ProviderApiServiceAbstraction {
  abstract setup(id: string, setupRequest: ProviderSetupRequest): Promise<ProviderResponse>;
  abstract update(id: string, updateRequest: ProviderUpdateRequest): Promise<ProviderResponse>;
  abstract get(id: string): Promise<ProviderResponse>;
}
