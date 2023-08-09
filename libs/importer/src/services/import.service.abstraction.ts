import { Importer } from "../importers/importer";
import { ImportOption, ImportType } from "../models/import-options";
import { ImportResult } from "../models/import-result";

export abstract class ImportServiceAbstraction {
  featuredImportOptions: readonly ImportOption[];
  regularImportOptions: readonly ImportOption[];
  getImportOptions: () => ImportOption[];
  import: (
    importer: Importer,
    fileContents: string,
    organizationId?: string,
    selectedImportTarget?: string,
    isUserAdmin?: boolean
  ) => Promise<ImportResult>;
  getImporter: (
    format: ImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId: string
  ) => Importer;
}
