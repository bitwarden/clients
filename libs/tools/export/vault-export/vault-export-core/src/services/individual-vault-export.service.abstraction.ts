import { ExportedVault } from "../types";

import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class IndividualVaultExportServiceAbstraction {
  abstract getExport: (format: ExportFormat) => Promise<ExportedVault>;
  abstract getPasswordProtectedExport: (password: string) => Promise<ExportedVault>;
}
