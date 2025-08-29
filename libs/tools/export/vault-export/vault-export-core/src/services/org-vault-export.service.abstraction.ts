import { UserId } from "@bitwarden/common/types/guid";

import { ExportedVaultAsString } from "../types";

import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class OrganizationVaultExportServiceAbstraction {
  abstract getPasswordProtectedExport: (
    userId: UserId,
    organizationId: string,
    password: string,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
  abstract getOrganizationExport: (
    userId: UserId,
    organizationId: string,
    format: ExportFormat,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
}
