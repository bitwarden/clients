// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { Importer } from "../importers/importer";
import { ImportOption, ImportType } from "../models/import-options";
import { ImportResult } from "../models/import-result";

export abstract class ImportServiceAbstraction {
  abstract featuredImportOptions: readonly ImportOption[];
  abstract regularImportOptions: readonly ImportOption[];
  abstract getImportOptions(): ImportOption[];
  abstract import(
    importer: Importer,
    fileContents: string,
    organizationId?: string,
    selectedImportTarget?: FolderView | CollectionView,
    canAccessImportExport?: boolean,
  ): Promise<ImportResult>;
  abstract getImporter(
    format: ImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId: string,
  ): Importer;
}
