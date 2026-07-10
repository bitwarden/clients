import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  Importer,
  ImportResult,
  ImportServiceAbstraction,
  SdkImportSummary,
} from "@bitwarden/importer-core";

import { Response } from "../models/response";
import { CliUtils } from "../utils";

import { ImportCommand } from "./import.command";

describe("ImportCommand", () => {
  let importService: MockProxy<ImportServiceAbstraction>;
  let organizationService: MockProxy<OrganizationService>;
  let syncService: MockProxy<SyncService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let i18nService: MockProxy<I18nService>;
  let command: ImportCommand;

  const importerStub = (): Importer => ({
    organizationId: "",
    parse: () => Promise.resolve(new ImportResult()),
  });

  const successResult = (): ImportResult => {
    const result = new ImportResult();
    result.success = true;
    return result;
  };

  const summary = (): SdkImportSummary => ({
    ciphers: [{ type: CipherType.Login, count: 3 }],
    folders: 2,
    collections: 0,
  });

  beforeEach(() => {
    importService = mock<ImportServiceAbstraction>();
    organizationService = mock<OrganizationService>();
    syncService = mock<SyncService>();
    accountService = mock<AccountService>();
    logService = mock<LogService>();
    i18nService = mock<I18nService>();
    command = new ImportCommand(
      importService,
      organizationService,
      syncService,
      accountService,
      logService,
      i18nService,
    );

    // KDBX is an SDK importer requiring a password + optional key file.
    importService.isSdkImporter.mockImplementation((format) => format === "keepasskdbx");
    importService.credentialKindFor.mockReturnValue("passwordWithKeyFile");
    importService.sdkErrorMessageKey.mockReturnValue(undefined);
    importService.importWithSdk.mockResolvedValue(summary());

    jest.spyOn(CliUtils, "readBinaryFile").mockResolvedValue(new Uint8Array([1, 2, 3]));
    jest.spyOn(CliUtils, "getPassword").mockResolvedValue("file-password");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("SDK-backed import (KDBX)", () => {
    it("reads the file as bytes and imports it through the SDK", async () => {
      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(CliUtils.readBinaryFile).toHaveBeenCalledWith("db.kdbx");
      expect(importService.importWithSdk).toHaveBeenCalledWith(
        "keepasskdbx",
        new Uint8Array([1, 2, 3]),
        { kind: "passwordWithKeyFile", password: "file-password", keyFile: null },
        undefined,
        undefined,
        true,
      );
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(response.success).toBe(true);
    });

    it("passes the key file from --keyfile in the collected credentials", async () => {
      await command.run("keepasskdbx", "db.kdbx", { keyfile: "secret.keyx" });

      expect(CliUtils.readBinaryFile).toHaveBeenCalledWith("secret.keyx");
      expect(importService.importWithSdk).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Uint8Array),
        {
          kind: "passwordWithKeyFile",
          password: "file-password",
          keyFile: new Uint8Array([1, 2, 3]),
        },
        undefined,
        undefined,
        true,
      );
    });

    it("resolves the password from --passwordenv/--passwordfile via CliUtils.getPassword", async () => {
      await command.run("keepasskdbx", "db.kdbx", { passwordenv: "BW_KDBX_PW" });

      expect(CliUtils.getPassword).toHaveBeenCalledWith(
        null,
        { passwordFile: undefined, passwordEnv: "BW_KDBX_PW" },
        logService,
        "Import file password:",
      );
    });

    it("returns a bad request when no password is available non-interactively", async () => {
      jest.spyOn(CliUtils, "getPassword").mockResolvedValue(Response.badRequest("no password"));

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(response.success).toBe(false);
      expect(importService.importWithSdk).not.toHaveBeenCalled();
    });

    it("returns a bad request when the file is empty", async () => {
      jest.spyOn(CliUtils, "readBinaryFile").mockResolvedValue(new Uint8Array());

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(response.success).toBe(false);
      expect(importService.importWithSdk).not.toHaveBeenCalled();
    });

    it("surfaces a mapped SDK error via i18n", async () => {
      importService.importWithSdk.mockRejectedValue(new Error("raw"));
      importService.sdkErrorMessageKey.mockReturnValue("kdbxWrongFileType");
      i18nService.t.mockReturnValue("Not a valid KeePass database.");

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(response.success).toBe(false);
      expect(i18nService.t).toHaveBeenCalledWith("kdbxWrongFileType");
    });

    it("falls back to the raw error when unmapped", async () => {
      importService.importWithSdk.mockRejectedValue(new Error("raw failure"));
      importService.sdkErrorMessageKey.mockReturnValue(undefined);

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(response.success).toBe(false);
    });
  });

  it("leaves non-sdk formats on the standard importer path", async () => {
    const readFileSpy = jest.spyOn(CliUtils, "readFile").mockResolvedValue("name,login\n");
    importService.getImporter.mockReturnValue(importerStub());
    importService.import.mockResolvedValue(successResult());

    await command.run("bitwardencsv", "data.csv", {});

    expect(readFileSpy).toHaveBeenCalledWith("data.csv");
    expect(importService.importWithSdk).not.toHaveBeenCalled();
  });
});
