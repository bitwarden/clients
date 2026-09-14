// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { Importer } from "../importers/importer";
import { ImportOption, ImportType } from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { SdkImportCredentials, SdkImportSummary } from "../sdk";

export abstract class ImportServiceAbstraction {
  /** Every supported importer. See `ImportOption.featuredImporter` to split featured/regular. */
  importOptions: readonly ImportOption[];
  getImportOptions: () => ImportOption[];
  /** The metadata record for a single format, or `undefined` if `id` isn't a known format. */
  getImportOption: (id: ImportType) => ImportOption | undefined;

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

  /** Maps an SDK importer error to a localization key, or `undefined` for the raw error. */
  sdkErrorMessageKey: (format: ImportType, error: unknown) => string | undefined;
  importWithSdk: (
    format: ImportType,
    file: Uint8Array,
    credentials: SdkImportCredentials,
    organizationId?: string,
    selectedImportTarget?: FolderView | CollectionView,
    canAccessImportExport?: boolean,
  ) => Promise<SdkImportSummary>;

  // Import an already-parsed ImportResult directly.
  importImportResult: (
    importResult: ImportResult,
    organizationId?: string,
    selectedImportTarget?: FolderView | CollectionView,
    canAccessImportExport?: boolean,
  ) => Promise<ImportResult>;
}
