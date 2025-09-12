import { OrganizationId } from "@bitwarden/common/types/guid";

import { ExportedVault } from "../types";

export const EXPORT_FORMATS = ["csv", "json", "encrypted_json", "zip"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export abstract class VaultExportServiceAbstraction {
  abstract getExport: (format: ExportFormat, password: string) => Promise<ExportedVault>;
  abstract getOrganizationExport: (
    organizationId: OrganizationId,
    format: ExportFormat,
    password: string,
    onlyManagedCollections?: boolean,
  ) => Promise<ExportedVault>;
}
