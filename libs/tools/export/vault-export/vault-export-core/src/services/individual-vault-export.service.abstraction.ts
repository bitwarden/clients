import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class IndividualVaultExportServiceAbstraction {
  getExport: (format: ExportFormat) => Promise<string | Blob>;
  getPasswordProtectedExport: (password: string) => Promise<string>;
}
