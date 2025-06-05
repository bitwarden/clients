import { ExportedVault } from "../types";

export const EXPORT_FORMATS = ["csv", "json", "encrypted_json", "zip"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export abstract class VaultExportServiceAbstraction {
  abstract getExport: (format: ExportFormat, password: string) => Promise<ExportedVault>;
  abstract getOrganizationExport: (
    organizationId: string,
    format: ExportFormat,
    password: string,
    onlyManagedCollections?: boolean,
  ) => Promise<ExportedVault>;
}
