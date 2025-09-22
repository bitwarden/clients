// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  CollectionService,
  CollectionWithIdRequest,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ImportCiphersRequest } from "@bitwarden/common/models/request/import-ciphers.request";
import { ImportOrganizationCiphersRequest } from "@bitwarden/common/models/request/import-organization-ciphers.request";
import { KvpRequest } from "@bitwarden/common/models/request/kvp.request";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType, toCipherTypeName } from "@bitwarden/common/vault/enums";
import { CipherRequest } from "@bitwarden/common/vault/models/request/cipher.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";

import {
  AscendoCsvImporter,
  AvastCsvImporter,
  AvastJsonImporter,
  AviraCsvImporter,
  BitwardenCsvImporter,
  BitwardenPasswordProtectedImporter,
  BlackBerryCsvImporter,
  BlurCsvImporter,
  ButtercupCsvImporter,
  ChromeCsvImporter,
  ClipperzHtmlImporter,
  CodebookCsvImporter,
  DashlaneCsvImporter,
  DashlaneJsonImporter,
  EncryptrCsvImporter,
  EnpassCsvImporter,
  EnpassJsonImporter,
  FirefoxCsvImporter,
  FSecureFskImporter,
  GnomeJsonImporter,
  KasperskyTxtImporter,
  KeePass2XmlImporter,
  KeePassXCsvImporter,
  KeeperCsvImporter,
  // KeeperJsonImporter,
  LastPassCsvImporter,
  LogMeOnceCsvImporter,
  MSecureCsvImporter,
  MeldiumCsvImporter,
  MykiCsvImporter,
  NetwrixPasswordSecureCsvImporter,
  NordPassCsvImporter,
  OnePassword1PifImporter,
  OnePassword1PuxImporter,
  OnePasswordMacCsvImporter,
  OnePasswordWinCsvImporter,
  PadlockCsvImporter,
  PassKeepCsvImporter,
  PasskyJsonImporter,
  PassmanJsonImporter,
  PasspackCsvImporter,
  PasswordAgentCsvImporter,
  PasswordBossJsonImporter,
  PasswordDragonXmlImporter,
  PasswordSafeXmlImporter,
  PasswordWalletTxtImporter,
  ProtonPassJsonImporter,
  PsonoJsonImporter,
  RememBearCsvImporter,
  RoboFormCsvImporter,
  SafariCsvImporter,
  SafeInCloudXmlImporter,
  SaferPassCsvImporter,
  SecureSafeCsvImporter,
  SplashIdCsvImporter,
  StickyPasswordXmlImporter,
  TrueKeyCsvImporter,
  UpmCsvImporter,
  YotiCsvImporter,
  ZohoVaultCsvImporter,
  PasswordXPCsvImporter,
  PasswordDepot17XmlImporter,
} from "../importers";
import { Importer } from "../importers/importer";
import { ImporterMetadata, Importers, Loader } from "../metadata";
import {
  featuredImportOptions,
  ImportOption,
  ImportType,
  regularImportOptions,
} from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { ImportApiServiceAbstraction } from "../services/import-api.service.abstraction";
import { ImportServiceAbstraction } from "../services/import.service.abstraction";
import { availableLoaders as availableLoaders } from "../util";

export class ImportService implements ImportServiceAbstraction {
  featuredImportOptions = featuredImportOptions as readonly ImportOption[];

  regularImportOptions = regularImportOptions as readonly ImportOption[];

  private logger: SemanticLogger;

  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private importApiService: ImportApiServiceAbstraction,
    private i18nService: I18nService,
    private collectionService: CollectionService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private pinService: PinServiceAbstraction,
    private accountService: AccountService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private system: SystemServiceProvider,
  ) {
    this.logger = system.log({ type: "ImportService" });
  }

  getImportOptions(): ImportOption[] {
    return this.featuredImportOptions.concat(this.regularImportOptions);
  }

  metadata$(type$: Observable<ImportType>): Observable<ImporterMetadata> {
    const browserEnabled$ = this.system.configService.getFeatureFlag$(
      FeatureFlag.UseChromiumImporter,
    );
    const client = this.system.environment.getClientType();
    const capabilities$ = combineLatest([type$, browserEnabled$]).pipe(
      map(([type, enabled]) => {
        let loaders = availableLoaders(type, client);

        let isUnsupported = false;

        if (enabled && type === "bravecsv") {
          try {
            const device = this.system.environment.getDevice();
            const isWindowsDesktop = device === DeviceType.WindowsDesktop;
            if (isWindowsDesktop) {
              isUnsupported = true;
            }
          } catch {
            isUnsupported = true;
          }
        }
        // If the feature flag is disabled, or if the browser is unsupported, remove the chromium loader
        if (!enabled || isUnsupported) {
          loaders = loaders?.filter((loader) => loader !== Loader.chromium);
        }

        const capabilities: ImporterMetadata = { type, loaders };
        if (type in Importers) {
          capabilities.instructions = Importers[type].instructions;
        }

        this.logger.debug({ importType: type, capabilities }, "capabilities updated");

        return capabilities;
      }),
    );

    return capabilities$;
  }

  async import(
    importer: Importer,
    fileContents: string,
    organizationId: OrganizationId = null,
    selectedImportTarget: FolderView | CollectionView = null,
    canAccessImportExport: boolean,
  ): Promise<ImportResult> {
    let importResult: ImportResult;
    try {
      importResult = await importer.parse(fileContents);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(this.i18nService.t("importFormatError"));
      }
      throw error;
    }

    if (!importResult.success) {
      if (!Utils.isNullOrWhitespace(importResult.errorMessage)) {
        throw new Error(importResult.errorMessage);
      }
      throw new Error(this.i18nService.t("importFormatError"));
    }

    if (importResult.folders.length === 0 && importResult.ciphers.length === 0) {
      throw new Error(this.i18nService.t("importNothingError"));
    }

    if (importResult.ciphers.length > 0) {
      const halfway = Math.floor(importResult.ciphers.length / 2);
      const last = importResult.ciphers.length - 1;

      if (
        this.badData(importResult.ciphers[0]) &&
        this.badData(importResult.ciphers[halfway]) &&
        this.badData(importResult.ciphers[last])
      ) {
        throw new Error(this.i18nService.t("importFormatError"));
      }
    }

    const restrictedItemTypes = await firstValueFrom(
      this.restrictedItemTypesService.restricted$.pipe(
        map((restrictedItemTypes) => restrictedItemTypes.map((r) => r.cipherType)),
      ),
    );

    // Filter out restricted item types from the import result
    importResult.ciphers = importResult.ciphers.filter(
      (cipher) => !restrictedItemTypes.includes(cipher.type),
    );

    if (organizationId && !selectedImportTarget && !canAccessImportExport) {
      const hasUnassignedCollections =
        importResult.collectionRelationships.length < importResult.ciphers.length;
      if (hasUnassignedCollections) {
        throw new Error(this.i18nService.t("importUnassignedItemsError"));
      }
    }

    try {
      await this.setImportTarget(importResult, organizationId, selectedImportTarget);
      if (organizationId != null) {
        await this.handleOrganizationalImport(importResult, organizationId);
      } else {
        await this.handleIndividualImport(importResult);
      }
    } catch (error) {
      const errorResponse = new ErrorResponse(error, 400);
      throw this.handleServerError(errorResponse, importResult);
    }
    return importResult;
  }

  getImporter(
    format: ImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
    organizationId: OrganizationId = null,
  ): Importer {
    if (promptForPassword_callback == null) {
      return null;
    }

    const importer = this.getImporterInstance(format, promptForPassword_callback);
    if (importer == null) {
      return null;
    }
    importer.organizationId = organizationId;
    return importer;
  }

  private getImporterInstance(
    format: ImportType | "bitwardenpasswordprotected",
    promptForPassword_callback: () => Promise<string>,
  ) {
    if (format == null) {
      return null;
    }

    switch (format) {
      case "bitwardencsv":
        return new BitwardenCsvImporter();
      case "bitwardenjson":
      case "bitwardenpasswordprotected":
        return new BitwardenPasswordProtectedImporter(
          this.keyService,
          this.encryptService,
          this.i18nService,
          this.cipherService,
          this.pinService,
          this.accountService,
          promptForPassword_callback,
        );
      case "lastpasscsv":
      case "passboltcsv":
        return new LastPassCsvImporter();
      case "keepassxcsv":
        return new KeePassXCsvImporter();
      case "aviracsv":
        return new AviraCsvImporter();
      case "blurcsv":
        return new BlurCsvImporter();
      case "safeincloudxml":
        return new SafeInCloudXmlImporter();
      case "padlockcsv":
        return new PadlockCsvImporter();
      case "keepass2xml":
        return new KeePass2XmlImporter();
      case "edgecsv":
      case "chromecsv":
      case "operacsv":
      case "vivaldicsv":
      case "bravecsv":
        return new ChromeCsvImporter();
      case "firefoxcsv":
        return new FirefoxCsvImporter();
      case "upmcsv":
        return new UpmCsvImporter();
      case "saferpasscsv":
        return new SaferPassCsvImporter();
      case "safaricsv":
        return new SafariCsvImporter();
      case "meldiumcsv":
        return new MeldiumCsvImporter();
      case "1password1pif":
        return new OnePassword1PifImporter();
      case "1password1pux":
        return new OnePassword1PuxImporter();
      case "1passwordwincsv":
        return new OnePasswordWinCsvImporter();
      case "1passwordmaccsv":
        return new OnePasswordMacCsvImporter();
      case "keepercsv":
        return new KeeperCsvImporter();
      // case "keeperjson":
      //   return new KeeperJsonImporter();
      case "passworddragonxml":
        return new PasswordDragonXmlImporter();
      case "enpasscsv":
        return new EnpassCsvImporter();
      case "enpassjson":
        return new EnpassJsonImporter();
      case "pwsafexml":
        return new PasswordSafeXmlImporter();
      case "dashlanecsv":
        return new DashlaneCsvImporter();
      case "dashlanejson":
        return new DashlaneJsonImporter();
      case "msecurecsv":
        return new MSecureCsvImporter();
      case "stickypasswordxml":
        return new StickyPasswordXmlImporter();
      case "truekeycsv":
        return new TrueKeyCsvImporter();
      case "clipperzhtml":
        return new ClipperzHtmlImporter();
      case "roboformcsv":
        return new RoboFormCsvImporter();
      case "ascendocsv":
        return new AscendoCsvImporter();
      case "passwordbossjson":
        return new PasswordBossJsonImporter();
      case "zohovaultcsv":
        return new ZohoVaultCsvImporter();
      case "splashidcsv":
        return new SplashIdCsvImporter();
      case "passkeepcsv":
        return new PassKeepCsvImporter();
      case "gnomejson":
        return new GnomeJsonImporter();
      case "passwordagentcsv":
        return new PasswordAgentCsvImporter();
      case "passpackcsv":
        return new PasspackCsvImporter();
      case "passmanjson":
        return new PassmanJsonImporter();
      case "avastcsv":
        return new AvastCsvImporter();
      case "avastjson":
        return new AvastJsonImporter();
      case "fsecurefsk":
        return new FSecureFskImporter();
      case "kasperskytxt":
        return new KasperskyTxtImporter();
      case "remembearcsv":
        return new RememBearCsvImporter();
      case "passwordwallettxt":
        return new PasswordWalletTxtImporter();
      case "mykicsv":
        return new MykiCsvImporter();
      case "securesafecsv":
        return new SecureSafeCsvImporter();
      case "logmeoncecsv":
        return new LogMeOnceCsvImporter();
      case "blackberrycsv":
        return new BlackBerryCsvImporter();
      case "buttercupcsv":
        return new ButtercupCsvImporter();
      case "codebookcsv":
        return new CodebookCsvImporter();
      case "encryptrcsv":
        return new EncryptrCsvImporter();
      case "yoticsv":
        return new YotiCsvImporter();
      case "nordpasscsv":
        return new NordPassCsvImporter();
      case "psonojson":
        return new PsonoJsonImporter();
      case "passkyjson":
        return new PasskyJsonImporter();
      case "protonpass":
        return new ProtonPassJsonImporter(this.i18nService);
      case "passwordxpcsv":
        return new PasswordXPCsvImporter();
      case "netwrixpasswordsecure":
        return new NetwrixPasswordSecureCsvImporter();
      case "passworddepot17xml":
        return new PasswordDepot17XmlImporter();
      default:
        return null;
    }
  }

  private async handleIndividualImport(importResult: ImportResult) {
    const request = new ImportCiphersRequest();
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    for (let i = 0; i < importResult.ciphers.length; i++) {
      const c = await this.cipherService.encrypt(importResult.ciphers[i], activeUserId);
      request.ciphers.push(new CipherRequest(c));
    }
    const userKey = await this.keyService.getUserKey(activeUserId);
    if (importResult.folders != null) {
      for (let i = 0; i < importResult.folders.length; i++) {
        const f = await this.folderService.encrypt(importResult.folders[i], userKey);
        request.folders.push(new FolderWithIdRequest(f));
      }
    }
    if (importResult.folderRelationships != null) {
      importResult.folderRelationships.forEach((r) =>
        request.folderRelationships.push(new KvpRequest(r[0], r[1])),
      );
    }
    return await this.importApiService.postImportCiphers(request);
  }

  private async handleOrganizationalImport(
    importResult: ImportResult,
    organizationId: OrganizationId,
  ) {
    const request = new ImportOrganizationCiphersRequest();
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    for (let i = 0; i < importResult.ciphers.length; i++) {
      importResult.ciphers[i].organizationId = organizationId;
      const c = await this.cipherService.encrypt(importResult.ciphers[i], activeUserId);
      request.ciphers.push(new CipherRequest(c));
    }
    if (importResult.collections != null) {
      for (let i = 0; i < importResult.collections.length; i++) {
        importResult.collections[i].organizationId = organizationId;
        const c = await this.collectionService.encrypt(importResult.collections[i], activeUserId);
        request.collections.push(new CollectionWithIdRequest(c));
      }
    }
    if (importResult.collectionRelationships != null) {
      importResult.collectionRelationships.forEach((r) =>
        request.collectionRelationships.push(new KvpRequest(r[0], r[1])),
      );
    }
    return await this.importApiService.postImportOrganizationCiphers(organizationId, request);
  }

  private badData(c: CipherView) {
    return (
      (c.name == null || c.name === "--") &&
      c.type === CipherType.Login &&
      c.login != null &&
      Utils.isNullOrWhitespace(c.login.password)
    );
  }

  private handleServerError(errorResponse: ErrorResponse, importResult: ImportResult): Error {
    if (errorResponse.validationErrors == null) {
      return new Error(errorResponse.message);
    }

    let errorMessage = "";

    Object.entries(errorResponse.validationErrors).forEach(([key, value], index) => {
      let item;
      let itemType;
      const i = Number(key.match(/[0-9]+/)[0]);

      switch (key.match(/^\w+/)[0]) {
        case "Ciphers":
          item = importResult.ciphers[i];
          itemType = toCipherTypeName(item.type);
          break;
        case "Folders":
          item = importResult.folders[i];
          itemType = "Folder";
          break;
        case "Collections":
          item = importResult.collections[i];
          itemType = "Collection";
          break;
        default:
          return;
      }

      if (index > 0) {
        errorMessage += "\n\n";
      }

      if (itemType !== "Folder" && itemType !== "Collection") {
        errorMessage += "[" + (i + 1) + "] ";
      }

      errorMessage += "[" + itemType + '] "' + item.name + '": ' + value;
    });

    return new Error(errorMessage);
  }

  private async setImportTarget(
    importResult: ImportResult,
    organizationId: string,
    importTarget: FolderView | CollectionView,
  ) {
    if (!importTarget) {
      return;
    }

    if (organizationId) {
      if (!(importTarget instanceof CollectionView)) {
        throw new Error(this.i18nService.t("errorAssigningTargetCollection"));
      }

      const noCollectionRelationShips: [number, number][] = [];
      importResult.ciphers.forEach((c, index) => {
        if (
          !Array.isArray(importResult.collectionRelationships) ||
          !importResult.collectionRelationships.some(([cipherPos]) => cipherPos === index)
        ) {
          noCollectionRelationShips.push([index, 0]);
        }
      });

      const collections: CollectionView[] = [...importResult.collections];
      importResult.collections = [importTarget as CollectionView];
      collections.map((x) => {
        const f = new CollectionView(x);
        f.name = `${importTarget.name}/${x.name}`;
        importResult.collections.push(f);
      });

      const relationships: [number, number][] = [...importResult.collectionRelationships];
      importResult.collectionRelationships = [...noCollectionRelationShips];
      relationships.map((x) => {
        importResult.collectionRelationships.push([x[0], x[1] + 1]);
      });

      return;
    }

    if (!(importTarget instanceof FolderView)) {
      throw new Error(this.i18nService.t("errorAssigningTargetFolder"));
    }

    const noFolderRelationShips: [number, number][] = [];
    importResult.ciphers.forEach((c, index) => {
      if (Utils.isNullOrEmpty(c.folderId)) {
        c.folderId = importTarget.id;
        noFolderRelationShips.push([index, 0]);
      }
    });

    const folders: FolderView[] = [...importResult.folders];
    importResult.folders = [importTarget as FolderView];
    folders.map((x) => {
      const newFolderName = `${importTarget.name}/${x.name}`;
      const f = new FolderView();
      f.name = newFolderName;
      importResult.folders.push(f);
    });

    const relationships: [number, number][] = [...importResult.folderRelationships];
    importResult.folderRelationships = [...noFolderRelationShips];
    relationships.map((x) => {
      importResult.folderRelationships.push([x[0], x[1] + 1]);
    });
  }
}
