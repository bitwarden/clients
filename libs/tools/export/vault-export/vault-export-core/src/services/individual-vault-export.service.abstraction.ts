// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class IndividualVaultExportServiceAbstraction {
  getExport: (format: ExportFormat) => Promise<string>;
  getPasswordProtectedExport: (password: string) => Promise<string>;
}
