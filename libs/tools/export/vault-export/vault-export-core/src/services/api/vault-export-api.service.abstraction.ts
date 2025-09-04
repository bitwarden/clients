import { OrganizationExportResponse } from "@bitwarden/common/admin-console/models/response/organization-export.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

export abstract class VaultExportApiServiceAbstraction {
  /**
   * Retrieves the export data for a specific organization.
   * @param organizationId The ID of the organization to export.
   * @returns A promise that resolves to the organization export response.
   */
  abstract getOrganizationExport(
    organizationId: OrganizationId,
  ): Promise<OrganizationExportResponse>;
}
