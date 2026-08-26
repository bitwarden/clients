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
  /**
   * Number of PAM-gated ("partial") ciphers a managed-collections export would omit.
   * Zero when nothing would be left out.
   */
  abstract getManagedExportGatedItemCount: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Promise<number>;
}
