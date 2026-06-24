import { UserId, OrganizationId } from "@bitwarden/common/types/guid";

import { ExportedVaultAsString } from "../types";

import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class OrganizationVaultExportServiceAbstraction {
  abstract getPasswordProtectedExport: (
    userId: UserId,
    organizationId: OrganizationId,
    password: string,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
  abstract getOrganizationExport: (
    userId: UserId,
    organizationId: OrganizationId,
    format: ExportFormat,
    onlyManagedCollections: boolean,
  ) => Promise<ExportedVaultAsString>;
}
