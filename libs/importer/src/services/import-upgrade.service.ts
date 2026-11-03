// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@bitwarden/legacy-crypto";

import { UpgradeBitwardenPasswordProtectedImporter } from "../importers/bitwarden-upgrade/upgrade-bitwarden-password-protected-importer";
import { Importer } from "../importers/importer";
import { KeeperDirectImporter } from "../importers/keeper/keeper-direct-importer";
import { ImportOption, ImportType, importOptionsById } from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { importUpgradeOptionsById, UpgradeImportType } from "../models/import-upgrade-options";
import { ImportResultError, ImportUpgradeResult } from "../models/import-upgrade-result";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";
import { ImportUpgradeServiceAbstraction } from "./import-upgrade.service.abstraction";
import { ImportService } from "./import.service";
import { restrictedTypesForDestination } from "./restricted-types-for-destination";

const isImportType = (id: string): id is ImportType =>
  Object.prototype.hasOwnProperty.call(importOptionsById, id);

/** `ImportService` for the upgraded import flow: reads the upgrade options table, uses importers
 *  that report a failure key, and throws errors that carry it. The legacy flow keeps using
 *  `ImportService` unchanged.
 *
 *  TODO: remove once pm-35053-import-upgrade is retired */
export class ImportUpgradeService extends ImportService implements ImportUpgradeServiceAbstraction {
  private readonly bitwardenImporterDeps: {
    keyService: KeyService;
    encryptService: EncryptService;
    i18nService: I18nService;
    cipherService: CipherService;
    keyGenerationService: KeyGenerationService;
    accountService: AccountService;
  };

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    importApiService: ImportApiServiceAbstraction,
    i18nService: I18nService,
    collectionService: CollectionService,
    keyService: KeyService,
    encryptService: EncryptService,
    keyGenerationService: KeyGenerationService,
    accountService: AccountService,
    restrictedItemTypesService: RestrictedItemTypesService,
    configService: ConfigService,
    sdkService: SdkService,
  ) {
    super(
      cipherService,
      folderService,
      importApiService,
      i18nService,
      collectionService,
      keyService,
      encryptService,
      keyGenerationService,
      accountService,
      restrictedItemTypesService,
      configService,
      sdkService,
    );
    this.bitwardenImporterDeps = {
      keyService,
      encryptService,
      i18nService,
      cipherService,
      keyGenerationService,
      accountService,
    };
  }

  override getImportOption(id: UpgradeImportType): ImportOption | undefined {
    const option = importUpgradeOptionsById[id];
    return option ? { id, ...option } : undefined;
  }

  override getImporter(
    format: UpgradeImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId?: OrganizationId,
  ): Importer {
    if (format !== "bitwardenjson" && format !== "bitwardenpasswordprotected") {
      // A picker vendor id (e.g. "keepass") has no importer of its own.
      return isImportType(format)
        ? super.getImporter(format, promptForPassword_callback, organizationId)
        : null;
    }
    if (promptForPassword_callback == null) {
      return null;
    }

    const deps = this.bitwardenImporterDeps;
    const importer = new UpgradeBitwardenPasswordProtectedImporter(
      deps.keyService,
      deps.encryptService,
      deps.i18nService,
      deps.cipherService,
      deps.keyGenerationService,
      deps.accountService,
      promptForPassword_callback,
    );
    importer.organizationId = organizationId;
    return importer;
  }

  /** Parses and checks `fileContents` exactly as `import` does, without importing. Credential
   *  parsing stages the result for location selection, which imports it. */
  async parse(importer: Importer, fileContents: string): Promise<ImportResult> {
    let importResult: ImportResult;
    try {
      importResult = await importer.parse(fileContents);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(this.bitwardenImporterDeps.i18nService.t("importFormatError"));
      }
      throw error;
    }
    this.validateParsed(importResult);
    return importResult;
  }

  protected override async restrictedTypesFor(
    organizationId: OrganizationId | null,
  ): Promise<CipherType[]> {
    return restrictedTypesForDestination(
      await firstValueFrom(this.restrictedItemTypesService.restricted$),
      organizationId,
    );
  }

  toOrganizationShape(importResult: ImportResult, organizationId: string): void {
    new KeeperDirectImporter().moveToOrganization(importResult, organizationId as OrganizationId);
  }

  /** The checks `importImportResult` runs before it imports, for a result parsed elsewhere. */
  validateParsed(importResult: ImportResult): void {
    this.throwIfFailed(importResult);
    this.validateImportResult(importResult);
  }

  private throwIfFailed(importResult: ImportResult): void {
    if (!importResult.success && !Utils.isNullOrWhitespace(importResult.errorMessage)) {
      throw new ImportResultError(
        importResult.errorMessage,
        importResult instanceof ImportUpgradeResult ? importResult.errorKey : undefined,
      );
    }
  }

  override async importImportResult(
    importResult: ImportResult,
    organizationId: OrganizationId = null,
    selectedImportTarget: FolderView | CollectionView = null,
    canAccessImportExport: boolean = false,
  ): Promise<ImportResult> {
    this.throwIfFailed(importResult);
    return super.importImportResult(
      importResult,
      organizationId,
      selectedImportTarget,
      canAccessImportExport,
    );
  }
}
