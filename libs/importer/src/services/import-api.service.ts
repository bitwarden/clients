import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ImportCiphersRequest } from "@bitwarden/common/models/request/import-ciphers.request";
import { ImportOrganizationCiphersRequest } from "@bitwarden/common/models/request/import-organization-ciphers.request";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";

export class ImportApiService implements ImportApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async postImportCiphers(request: ImportCiphersRequest): Promise<any> {
    return await this.apiService.send("POST", "/ciphers/import", request, true, false);
  }

  async postImportOrganizationCiphers(
    organizationId: string,
    request: ImportOrganizationCiphersRequest,
  ): Promise<any> {
    return await this.apiService.send(
      "POST",
      "/ciphers/import-organization?organizationId=" + organizationId,
      request,
      true,
      false,
    );
  }
}
