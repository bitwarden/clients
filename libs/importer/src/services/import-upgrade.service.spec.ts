// Polyfill Symbol.dispose for explicit resource management (used by the SDK client `using`)
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@bitwarden/legacy-crypto";

import { BitwardenCsvImporter } from "../importers";
import { UpgradeBitwardenPasswordProtectedImporter } from "../importers/bitwarden-upgrade/upgrade-bitwarden-password-protected-importer";
import { Importer } from "../importers/importer";
import { ImportResult } from "../models/import-result";
import {
  ImportResultError,
  ImportResultErrorKey,
  ImportUpgradeResult,
} from "../models/import-upgrade-result";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";
import { ImportUpgradeService } from "./import-upgrade.service";

describe("ImportUpgradeService", () => {
  let importService: ImportUpgradeService;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let i18nService: ReturnType<typeof mock<I18nService>>;

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    importService = new ImportUpgradeService(
      mock<CipherService>(),
      mock<FolderService>(),
      mock<ImportApiServiceAbstraction>(),
      i18nService,
      mock<CollectionService>(),
      mock<KeyService>(),
      mock<EncryptService>(),
      mock<KeyGenerationService>(),
      mock<AccountService>(),
      mock<RestrictedItemTypesService>(),
      configService,
      mock<SdkService>(),
    );
  });

  describe("getImportOption", () => {
    it("resolves picker vendor ids that the shared options table does not have", () => {
      expect(importService.getImportOption("keepass")?.id).toBe("keepass");
      expect(importService.getImportOption("1password")?.id).toBe("1password");
    });

    it("resolves a real format from the same table", () => {
      expect(importService.getImportOption("keepass2xml")?.id).toBe("keepass2xml");
    });

    it("returns undefined for an unknown id", () => {
      expect(importService.getImportOption("nope" as any)).toBeUndefined();
    });
  });

  describe("importImportResult", () => {
    const failedWith = async (importResult: ImportResult): Promise<unknown> => {
      try {
        await importService.importImportResult(importResult);
      } catch (error) {
        return error;
      }
      return undefined;
    };

    it("throws an ImportResultError carrying errorKey when the result failed with one", async () => {
      const importResult = new ImportUpgradeResult();
      importResult.success = false;
      importResult.errorMessage = "invalidFilePassword";
      importResult.errorKey = ImportResultErrorKey.InvalidFilePassword;

      const thrown = await failedWith(importResult);

      expect(thrown).toBeInstanceOf(ImportResultError);
      expect((thrown as ImportResultError).message).toBe("invalidFilePassword");
      expect((thrown as ImportResultError).errorKey).toBe(ImportResultErrorKey.InvalidFilePassword);
    });

    it("throws with an undefined errorKey when the failed result didn't set one", async () => {
      const importResult = new ImportUpgradeResult();
      importResult.success = false;
      importResult.errorMessage = "Missing `database` node.";

      const thrown = await failedWith(importResult);

      expect(thrown).toBeInstanceOf(ImportResultError);
      expect((thrown as ImportResultError).errorKey).toBeUndefined();
    });

    it("throws with an undefined errorKey for a plain ImportResult", async () => {
      const importResult = new ImportResult();
      importResult.success = false;
      importResult.errorMessage = "Missing `database` node.";

      const thrown = await failedWith(importResult);

      expect(thrown).toBeInstanceOf(ImportResultError);
      expect((thrown as ImportResultError).errorKey).toBeUndefined();
    });
  });

  describe("parse and validateParsed", () => {
    const goodResult = () => {
      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.name = "Example";
      cipher.login = new LoginView();
      cipher.login.password = "secret";
      const result = new ImportResult();
      result.success = true;
      result.ciphers = [cipher];
      return result;
    };

    const importerReturning = (result: ImportResult) => {
      const importer = mock<Importer>();
      importer.parse.mockResolvedValue(result);
      return importer;
    };

    const failedWith = async (action: () => unknown): Promise<unknown> => {
      try {
        await action();
      } catch (error) {
        return error;
      }
      return undefined;
    };

    it("returns the parsed result and does not import it", async () => {
      const result = goodResult();
      const importSpy = jest.spyOn(importService, "importImportResult");

      const parsed = await importService.parse(importerReturning(result), "contents");

      expect(parsed).toBe(result);
      expect(importSpy).not.toHaveBeenCalled();
    });

    it("maps a SyntaxError from the importer to the format error", async () => {
      const importer = mock<Importer>();
      importer.parse.mockRejectedValue(new SyntaxError("Unexpected token"));

      const thrown = await failedWith(() => importService.parse(importer, "contents"));

      expect((thrown as Error).message).toBe("importFormatError");
    });

    it("rethrows any other importer error unchanged", async () => {
      const error = new Error("boom");
      const importer = mock<Importer>();
      importer.parse.mockRejectedValue(error);

      expect(await failedWith(() => importService.parse(importer, "contents"))).toBe(error);
    });

    it("throws an ImportResultError carrying errorKey for a failed result", async () => {
      const result = new ImportUpgradeResult();
      result.success = false;
      result.errorMessage = "importEncKeyError";
      result.errorKey = ImportResultErrorKey.AccountMismatch;

      const thrown = await failedWith(() => importService.parse(importerReturning(result), "x"));

      expect(thrown).toBeInstanceOf(ImportResultError);
      expect((thrown as ImportResultError).errorKey).toBe(ImportResultErrorKey.AccountMismatch);
    });

    it("rejects a result with nothing to import", async () => {
      const result = new ImportResult();
      result.success = true;

      const thrown = await failedWith(() => importService.parse(importerReturning(result), "x"));

      expect((thrown as Error).message).toBe("importNothingError");
    });

    it("validateParsed accepts a good result and rejects a failed one", async () => {
      expect(() => importService.validateParsed(goodResult())).not.toThrow();

      const failed = new ImportResult();
      failed.success = false;
      failed.errorMessage = "Missing `database` node.";
      expect(await failedWith(() => importService.validateParsed(failed))).toBeInstanceOf(
        ImportResultError,
      );
    });
  });

  describe("toOrganizationShape", () => {
    it("turns folders into the organization's collections, in place", () => {
      const result = new ImportResult();
      const folder = new FolderView();
      folder.name = "Work";
      result.folders = [folder];
      result.folderRelationships = [[0, 0]];

      importService.toOrganizationShape(result, "org-1");

      expect(result.folders).toEqual([]);
      expect(result.folderRelationships).toEqual([]);
      expect(result.collections.map((c) => [c.name, c.organizationId])).toEqual([
        ["Work", "org-1"],
      ]);
      expect(result.collectionRelationships).toEqual([[0, 0]]);
    });
  });

  describe("getImporter", () => {
    const prompt = () => Promise.resolve("password");

    it.each(["bitwardenjson", "bitwardenpasswordprotected"] as const)(
      "returns the failure-key reporting importer for %s",
      (format) => {
        expect(importService.getImporter(format, prompt)).toBeInstanceOf(
          UpgradeBitwardenPasswordProtectedImporter,
        );
      },
    );

    it("returns null for the Bitwarden formats without a password callback", () => {
      expect(importService.getImporter("bitwardenjson", null)).toBeNull();
    });

    it("delegates every other real format to the shared service", () => {
      expect(importService.getImporter("bitwardencsv", prompt)).toBeInstanceOf(
        BitwardenCsvImporter,
      );
    });

    it("returns null for a picker vendor id, which has no importer of its own", () => {
      expect(importService.getImporter("keepass", prompt)).toBeNull();
    });
  });
});
