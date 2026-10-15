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
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@bitwarden/legacy-crypto";

import { BitwardenCsvImporter } from "../importers";
import { UpgradeBitwardenPasswordProtectedImporter } from "../importers/bitwarden-upgrade/upgrade-bitwarden-password-protected-importer";
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

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    importService = new ImportUpgradeService(
      mock<CipherService>(),
      mock<FolderService>(),
      mock<ImportApiServiceAbstraction>(),
      mock<I18nService>(),
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
