export const EXPORT_FORMATS = ["csv", "json", "encrypted_json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export abstract class VaultExportServiceAbstraction {
  getExport: (format: ExportFormat, password: string) => Promise<string>;
  getOrganizationExport: (
    organizationId: string,
    format: ExportFormat,
    password: string,
    onlyManagedCollections?: boolean,
  ) => Promise<string>;
  getFileName: (prefix?: string, extension?: string) => string;
}
