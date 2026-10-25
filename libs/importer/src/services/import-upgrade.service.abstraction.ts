import { Importer } from "../importers/importer";
import { ImportOption } from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { UpgradeImportType } from "../models/import-upgrade-options";

import { ImportServiceAbstraction } from "./import.service.abstraction";

// TODO: remove once pm-35053-import-upgrade is retired
export abstract class ImportUpgradeServiceAbstraction {
  /** The metadata record for a single format or picker vendor, or `undefined` if `id` is unknown. */
  abstract getImportOption: (id: UpgradeImportType) => ImportOption | undefined;
  abstract import: ImportServiceAbstraction["import"];
  /** Parses and checks like `import`, but stops before importing so the result can be staged. */
  abstract parse: (importer: Importer, fileContents: string) => Promise<ImportResult>;
  /** The checks run before an import, for a result that was parsed elsewhere (e.g. Keeper). */
  abstract validateParsed: (importResult: ImportResult) => void;
  /** Reshapes, in place, a result the direct Keeper importer converted without an organization. */
  abstract toOrganizationShape: (importResult: ImportResult, organizationId: string) => void;
  abstract getImporter: (
    format: UpgradeImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId?: string,
  ) => Importer | null;
  abstract sdkErrorMessageKey: ImportServiceAbstraction["sdkErrorMessageKey"];
  abstract importWithSdk: ImportServiceAbstraction["importWithSdk"];
  abstract importImportResult: ImportServiceAbstraction["importImportResult"];
}
