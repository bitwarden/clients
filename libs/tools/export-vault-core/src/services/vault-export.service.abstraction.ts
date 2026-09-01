import { Observable } from "rxjs";

import { UserId, OrganizationId } from "@bitwarden/common/types/guid";

import { ExportedVault } from "../types";

export const EXPORT_FORMATS = ["csv", "json", "encrypted_json", "zip"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Options that determine which export formats are available
 */
export type FormatOptions = {
  /** Whether the export is for the user's personal vault */
  isMyVault: boolean;
};

/**
 * Metadata describing an available export format
 */
export type ExportFormatMetadata = {
  /** Display name for the format (e.g., ".json", ".csv") */
  name: string;
  /** The export format identifier */
  format: ExportFormat;
};

export abstract class VaultExportServiceAbstraction {
  abstract getExport: (
    userId: UserId,
    format: ExportFormat,
    password: string,
  ) => Promise<ExportedVault>;
  abstract getOrganizationExport: (
    userId: UserId,
    organizationId: OrganizationId,
    format: ExportFormat,
    password: string,
    onlyManagedCollections?: boolean,
  ) => Promise<ExportedVault>;

  /**
   * Get available export formats based on vault context
   * @param options Options determining which formats are available
   * @returns Observable stream of available export formats
   */
  abstract formats$(options: FormatOptions): Observable<ExportFormatMetadata[]>;
}
