import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationExportResponse } from "@bitwarden/common/admin-console/models/response/organization-export.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { VaultExportApiServiceAbstraction } from "./vault-export-api.service.abstraction";

/**
 * Service for handling vault export API interactions.
 * @param apiService - An instance of {@link ApiService} used to make HTTP requests.
 */
export class VaultExportApiService implements VaultExportApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async getOrganizationExport(organizationId: OrganizationId): Promise<OrganizationExportResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/export",
      null,
      true,
      true,
    );
    return new OrganizationExportResponse(r);
  }
}
