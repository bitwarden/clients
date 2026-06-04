import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  Importer,
  ImportResult,
  ImportServiceAbstraction,
  KdbxCredentials,
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

  beforeEach(() => {
    importService = mock<ImportServiceAbstraction>();
    organizationService = mock<OrganizationService>();
    syncService = mock<SyncService>();
    accountService = mock<AccountService>();
    logService = mock<LogService>();
    command = new ImportCommand(
      importService,
      organizationService,
      syncService,
      accountService,
      logService,
    );

    importService.getImporter.mockReturnValue(importerStub());
    importService.import.mockResolvedValue(successResult());
    jest.spyOn(CliUtils, "readFileAsBase64").mockResolvedValue("BASE64-CONTENTS");
    jest.spyOn(CliUtils, "readBinaryFile").mockResolvedValue(new Uint8Array([1, 2, 3]));
    jest.spyOn(CliUtils, "getPassword").mockResolvedValue("file-password");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("KeePass KDBX import", () => {
    it("reads the file as base64 and supplies a kdbx credentials callback", async () => {
      const importer = importerStub();
      importService.getImporter.mockReturnValue(importer);

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(CliUtils.readFileAsBase64).toHaveBeenCalledWith("db.kdbx");
      expect(importService.getImporter).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Function),
        undefined,
        expect.any(Function),
      );
      expect(importService.import).toHaveBeenCalledWith(importer, "BASE64-CONTENTS", undefined);
      expect(response.success).toBe(true);
    });

    it("resolves the key file from --keyfile and the password into the credentials", async () => {
      let kdbxCredentialsCallback: () => Promise<KdbxCredentials>;
      importService.getImporter.mockImplementation((_format, _pw, _org, kdbxCallback) => {
        kdbxCredentialsCallback = kdbxCallback;
        return importerStub();
      });

      await command.run("keepasskdbx", "db.kdbx", { keyfile: "secret.keyx" });
      const credentials = await kdbxCredentialsCallback();

      expect(CliUtils.readBinaryFile).toHaveBeenCalledWith("secret.keyx");
      expect(credentials).toEqual({
        password: "file-password",
        keyFile: new Uint8Array([1, 2, 3]),
      });
    });

    it("omits the key file when --keyfile is not provided", async () => {
      let kdbxCredentialsCallback: () => Promise<KdbxCredentials>;
      importService.getImporter.mockImplementation((_format, _pw, _org, kdbxCallback) => {
        kdbxCredentialsCallback = kdbxCallback;
        return importerStub();
      });

      await command.run("keepasskdbx", "db.kdbx", {});
      const credentials = await kdbxCredentialsCallback();

      expect(CliUtils.readBinaryFile).not.toHaveBeenCalled();
      expect(credentials.keyFile).toBeNull();
    });

    it("resolves the password from --passwordenv/--passwordfile via CliUtils.getPassword", async () => {
      let passwordCallback: () => Promise<string>;
      importService.getImporter.mockImplementation((_format, pwCallback) => {
        passwordCallback = pwCallback;
        return importerStub();
      });

      await command.run("keepasskdbx", "db.kdbx", { passwordenv: "BW_KDBX_PW" });
      const password = await passwordCallback();

      expect(CliUtils.getPassword).toHaveBeenCalledWith(
        null,
        { passwordFile: undefined, passwordEnv: "BW_KDBX_PW" },
        logService,
        "Import file password:",
      );
      expect(password).toBe("file-password");
    });

    it("returns a bad request when no password is available non-interactively", async () => {
      jest.spyOn(CliUtils, "getPassword").mockResolvedValue(Response.badRequest("no password"));
      let kdbxCredentialsCallback: () => Promise<KdbxCredentials>;
      importService.getImporter.mockImplementation((_format, _pw, _org, kdbxCallback) => {
        kdbxCredentialsCallback = kdbxCallback;
        return importerStub();
      });
      // Simulate the importer invoking the credentials callback during parse.
      importService.import.mockImplementation(async () => {
        await kdbxCredentialsCallback();
        return successResult();
      });

      const response = await command.run("keepasskdbx", "db.kdbx", {});

      expect(response.success).toBe(false);
      expect(importService.import).toHaveBeenCalled();
    });

    it("leaves non-kdbx formats on the utf-8 text read path", async () => {
      const readFileSpy = jest.spyOn(CliUtils, "readFile").mockResolvedValue("name,login\n");

      await command.run("bitwardencsv", "data.csv", {});

      expect(readFileSpy).toHaveBeenCalledWith("data.csv");
      expect(CliUtils.readFileAsBase64).not.toHaveBeenCalled();
    });
  });
});
