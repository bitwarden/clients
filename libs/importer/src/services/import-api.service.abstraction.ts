import { ImportCiphersRequest } from "@bitwarden/common/models/request/import-ciphers.request";
import { ImportOrganizationCiphersRequest } from "@bitwarden/common/models/request/import-organization-ciphers.request";

export abstract class ImportApiServiceAbstraction {
  abstract postImportCiphers(request: ImportCiphersRequest): Promise<any>;
  abstract postImportOrganizationCiphers(
    organizationId: string,
    request: ImportOrganizationCiphersRequest,
  ): Promise<any>;
}
