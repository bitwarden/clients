// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

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
    selectedImportTarget?: FolderView | CollectionView,
    canAccessImportExport?: boolean,
  ) => Promise<ImportResult>;
  getImporter: (
    format: ImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId: string,
  ) => Importer;
}
