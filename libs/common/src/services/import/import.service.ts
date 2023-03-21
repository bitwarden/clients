import { CollectionService } from "../../abstractions/collection.service";
import { CryptoService } from "../../abstractions/crypto.service";
import { I18nService } from "../../abstractions/i18n.service";
import { ImportApiServiceAbstraction } from "../../abstractions/import/import-api.service.abstraction";
import { ImportService as ImportServiceAbstraction } from "../../abstractions/import/import.service.abstraction";
import {
  featuredImportOptions,
  ImportOption,
  ImportType,
  regularImportOptions,
} from "../../enums/importOptions";
import { AscendoCsvImporter } from "../../importers/ascendo-csv-importer";
import { AvastCsvImporter } from "../../importers/avast-csv-importer";
import { AvastJsonImporter } from "../../importers/avast-json-importer";
import { AviraCsvImporter } from "../../importers/avira-csv-importer";
import { BitwardenCsvImporter } from "../../importers/bitwarden-csv-importer";
import { BitwardenJsonImporter } from "../../importers/bitwarden-json-importer";
import { BitwardenPasswordProtectedImporter } from "../../importers/bitwarden-password-protected-importer";
import { BlackBerryCsvImporter } from "../../importers/blackberry-csv-importer";
import { BlurCsvImporter } from "../../importers/blur-csv-importer";
import { ButtercupCsvImporter } from "../../importers/buttercup-csv-importer";
import { ChromeCsvImporter } from "../../importers/chrome-csv-importer";
import { ClipperzHtmlImporter } from "../../importers/clipperz-html-importer";
import { CodebookCsvImporter } from "../../importers/codebook-csv-importer";
import { DashlaneCsvImporter } from "../../importers/dashlane/dashlane-csv-importer";
import { DashlaneJsonImporter } from "../../importers/dashlane/dashlane-json-importer";
import { EncryptrCsvImporter } from "../../importers/encryptr-csv-importer";
import { EnpassCsvImporter } from "../../importers/enpass/enpass-csv-importer";
import { EnpassJsonImporter } from "../../importers/enpass/enpass-json-importer";
import { FirefoxCsvImporter } from "../../importers/firefox-csv-importer";
import { FSecureFskImporter } from "../../importers/fsecure/fsecure-fsk-importer";
import { GnomeJsonImporter } from "../../importers/gnome-json-importer";
import { ImportError } from "../../importers/import-error";
import { Importer } from "../../importers/importer";
import { KasperskyTxtImporter } from "../../importers/kaspersky-txt-importer";
import { KeePass2XmlImporter } from "../../importers/keepass2-xml-importer";
import { KeePassXCsvImporter } from "../../importers/keepassx-csv-importer";
import { KeeperCsvImporter } from "../../importers/keeper/keeper-csv-importer";
import { LastPassCsvImporter } from "../../importers/lastpass-csv-importer";
import { LogMeOnceCsvImporter } from "../../importers/logmeonce-csv-importer";
import { MeldiumCsvImporter } from "../../importers/meldium-csv-importer";
import { MSecureCsvImporter } from "../../importers/msecure-csv-importer";
import { MykiCsvImporter } from "../../importers/myki-csv-importer";
import { NordPassCsvImporter } from "../../importers/nordpass-csv-importer";
import { OnePassword1PifImporter } from "../../importers/onepassword/onepassword-1pif-importer";
import { OnePassword1PuxImporter } from "../../importers/onepassword/onepassword-1pux-importer";
import { OnePasswordMacCsvImporter } from "../../importers/onepassword/onepassword-mac-csv-importer";
import { OnePasswordWinCsvImporter } from "../../importers/onepassword/onepassword-win-csv-importer";
import { PadlockCsvImporter } from "../../importers/padlock-csv-importer";
import { PassKeepCsvImporter } from "../../importers/passkeep-csv-importer";
import { PasskyJsonImporter } from "../../importers/passky/passky-json-importer";
import { PassmanJsonImporter } from "../../importers/passman-json-importer";
import { PasspackCsvImporter } from "../../importers/passpack-csv-importer";
import { PasswordAgentCsvImporter } from "../../importers/passwordagent-csv-importer";
import { PasswordBossJsonImporter } from "../../importers/passwordboss-json-importer";
import { PasswordDragonXmlImporter } from "../../importers/passworddragon-xml-importer";
import { PasswordSafeXmlImporter } from "../../importers/passwordsafe-xml-importer";
import { PasswordWalletTxtImporter } from "../../importers/passwordwallet-txt-importer";
import { PsonoJsonImporter } from "../../importers/psono/psono-json-importer";
import { RememBearCsvImporter } from "../../importers/remembear-csv-importer";
import { RoboFormCsvImporter } from "../../importers/roboform-csv-importer";
import { SafariCsvImporter } from "../../importers/safari-csv-importer";
import { SafeInCloudXmlImporter } from "../../importers/safeincloud-xml-importer";
import { SaferPassCsvImporter } from "../../importers/saferpass-csv-importer";
import { SecureSafeCsvImporter } from "../../importers/securesafe-csv-importer";
import { SplashIdCsvImporter } from "../../importers/splashid-csv-importer";
import { StickyPasswordXmlImporter } from "../../importers/stickypassword-xml-importer";
import { TrueKeyCsvImporter } from "../../importers/truekey-csv-importer";
import { UpmCsvImporter } from "../../importers/upm-csv-importer";
import { YotiCsvImporter } from "../../importers/yoti-csv-importer";
import { ZohoVaultCsvImporter } from "../../importers/zohovault-csv-importer";
import { Utils } from "../../misc/utils";
import { ImportResult } from "../../models/domain/import-result";
import { CollectionRequest } from "../../models/request/collection.request";
import { ImportCiphersRequest } from "../../models/request/import-ciphers.request";
import { ImportOrganizationCiphersRequest } from "../../models/request/import-organization-ciphers.request";
import { KvpRequest } from "../../models/request/kvp.request";
import { ErrorResponse } from "../../models/response/error.response";
import { Guid } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { FolderService } from "../../vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "../../vault/enums/cipher-type";
import { CipherRequest } from "../../vault/models/request/cipher.request";
import { FolderRequest } from "../../vault/models/request/folder.request";
import { CipherView } from "../../vault/models/view/cipher.view";

export class ImportService implements ImportServiceAbstraction {
  featuredImportOptions = featuredImportOptions as readonly ImportOption[];

  regularImportOptions = regularImportOptions as readonly ImportOption[];

  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private importApiService: ImportApiServiceAbstraction,
    private i18nService: I18nService,
    private collectionService: CollectionService,
    private cryptoService: CryptoService
  ) {}

  getImportOptions(): ImportOption[] {
    return this.featuredImportOptions.concat(this.regularImportOptions);
  }

  async import(
    importer: Importer,
    fileContents: string,
    organizationId: Guid = null
  ): Promise<ImportError> {
    const importResult = await importer.parse(fileContents);
    if (importResult.success) {
      if (importResult.folders.length === 0 && importResult.ciphers.length === 0) {
        return new ImportError(this.i18nService.t("importNothingError"));
      } else if (importResult.ciphers.length > 0) {
        const halfway = Math.floor(importResult.ciphers.length / 2);
        const last = importResult.ciphers.length - 1;

        if (
          this.badData(importResult.ciphers[0]) &&
          this.badData(importResult.ciphers[halfway]) &&
          this.badData(importResult.ciphers[last])
        ) {
          return new ImportError(this.i18nService.t("importFormatError"));
        }
      }
      try {
        await this.postImport(importResult, organizationId);
      } catch (error) {
        const errorResponse = new ErrorResponse(error, 400);
        return this.handleServerError(errorResponse, importResult);
      }
      return null;
    } else {
      if (!Utils.isNullOrWhitespace(importResult.errorMessage)) {
        return new ImportError(importResult.errorMessage, importResult.missingPassword);
      } else {
        return new ImportError(
          this.i18nService.t("importFormatError"),
          importResult.missingPassword
        );
      }
    }
  }

  getImporter(
    format: ImportType | "bitwardenpasswordprotected",
    organizationId: Guid = null,
    password: string = null
  ): Importer {
    const importer = this.getImporterInstance(format, password);
    if (importer == null) {
      return null;
    }
    importer.organizationId = organizationId;
    return importer;
  }

  private getImporterInstance(format: ImportType | "bitwardenpasswordprotected", password: string) {
    if (format == null) {
      return null;
    }

    switch (format) {
      case "bitwardencsv":
        return new BitwardenCsvImporter();
      case "bitwardenjson":
        return new BitwardenJsonImporter(this.cryptoService, this.i18nService);
      case "bitwardenpasswordprotected":
        return new BitwardenPasswordProtectedImporter(
          this.cryptoService,
          this.i18nService,
          password
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
      case "chromecsv":
      case "operacsv":
      case "vivaldicsv":
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
      default:
        return null;
    }
  }

  private async postImport(importResult: ImportResult, organizationId: Guid = null) {
    if (organizationId == null) {
      const request = new ImportCiphersRequest();
      for (let i = 0; i < importResult.ciphers.length; i++) {
        const c = await this.cipherService.encrypt(importResult.ciphers[i]);
        request.ciphers.push(new CipherRequest(c));
      }
      if (importResult.folders != null) {
        for (let i = 0; i < importResult.folders.length; i++) {
          const f = await this.folderService.encrypt(importResult.folders[i]);
          request.folders.push(new FolderRequest(f));
        }
      }
      if (importResult.folderRelationships != null) {
        importResult.folderRelationships.forEach((r) =>
          request.folderRelationships.push(new KvpRequest(r[0], r[1]))
        );
      }
      return await this.importApiService.postImportCiphers(request);
    } else {
      const request = new ImportOrganizationCiphersRequest();
      for (let i = 0; i < importResult.ciphers.length; i++) {
        importResult.ciphers[i].organizationId = organizationId;
        const c = await this.cipherService.encrypt(importResult.ciphers[i]);
        request.ciphers.push(new CipherRequest(c));
      }
      if (importResult.collections != null) {
        for (let i = 0; i < importResult.collections.length; i++) {
          importResult.collections[i].organizationId = organizationId;
          const c = await this.collectionService.encrypt(importResult.collections[i]);
          request.collections.push(new CollectionRequest(c));
        }
      }
      if (importResult.collectionRelationships != null) {
        importResult.collectionRelationships.forEach((r) =>
          request.collectionRelationships.push(new KvpRequest(r[0], r[1]))
        );
      }
      return await this.importApiService.postImportOrganizationCiphers(organizationId, request);
    }
  }

  private badData(c: CipherView) {
    return (
      (c.name == null || c.name === "--") &&
      c.type === CipherType.Login &&
      c.login != null &&
      Utils.isNullOrWhitespace(c.login.password)
    );
  }

  private handleServerError(errorResponse: ErrorResponse, importResult: ImportResult): ImportError {
    if (errorResponse.validationErrors == null) {
      return new ImportError(errorResponse.message);
    }

    let errorMessage = "";

    Object.entries(errorResponse.validationErrors).forEach(([key, value], index) => {
      let item;
      let itemType;
      const i = Number(key.match(/[0-9]+/)[0]);

      switch (key.match(/^\w+/)[0]) {
        case "Ciphers":
          item = importResult.ciphers[i];
          itemType = CipherType[item.type];
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

    return new ImportError(errorMessage);
  }
}
