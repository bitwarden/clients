import { Importer } from "../importers/importer";
import { ImportOption } from "../models/import-options";
import { UpgradeImportType } from "../models/import-upgrade-options";

import { ImportServiceAbstraction } from "./import.service.abstraction";

// TODO: remove once pm-35053-import-upgrade is retired
export abstract class ImportUpgradeServiceAbstraction {
  /** The metadata record for a single format or picker vendor, or `undefined` if `id` is unknown. */
  abstract getImportOption: (id: UpgradeImportType) => ImportOption | undefined;
  abstract import: ImportServiceAbstraction["import"];
  abstract getImporter: (
    format: UpgradeImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId?: string,
  ) => Importer | null;
  abstract sdkErrorMessageKey: ImportServiceAbstraction["sdkErrorMessageKey"];
  abstract importWithSdk: ImportServiceAbstraction["importWithSdk"];
  abstract importImportResult: ImportServiceAbstraction["importImportResult"];
}
