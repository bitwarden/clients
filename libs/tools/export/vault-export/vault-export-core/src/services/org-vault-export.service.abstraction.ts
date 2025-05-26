import { ExportedVaultAsString } from "../types";

import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class OrganizationVaultExportServiceAbstraction {
  abstract getPasswordProtectedExport: (
    organizationId: string,
    password: string,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
  abstract getOrganizationExport: (
    organizationId: string,
    format: ExportFormat,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
}
