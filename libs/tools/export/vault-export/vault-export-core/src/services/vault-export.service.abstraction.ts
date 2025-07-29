import { UserId } from "@bitwarden/common/types/guid";

import { ExportedVault } from "../types";

export const EXPORT_FORMATS = ["csv", "json", "encrypted_json", "zip"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export abstract class VaultExportServiceAbstraction {
  abstract getExport: (
    userId: UserId,
    format: ExportFormat,
    password: string,
  ) => Promise<ExportedVault>;
  abstract getOrganizationExport: (
    userId: UserId,
    organizationId: string,
    format: ExportFormat,
    password: string,
    onlyManagedCollections?: boolean,
  ) => Promise<ExportedVault>;
}
