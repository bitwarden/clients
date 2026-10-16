import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { SecretsManagerPortingApiService } from "@bitwarden/bit-common/secrets-manager/settings/services/sm-porting-api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smUserId } from "../spec/sm-test-utils";

import { SmExportCommand } from "./sm-export.command";

describe("SmExportCommand", () => {
  const portingApiService = mock<SecretsManagerPortingApiService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const userVerificationService = mock<UserVerificationService>();
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const logService = mock<LogService>();
  const masterPassword = "correct horse battery staple";
  const passwordEnv = "BW_SM_EXPORT_TEST_PASSWORD";
  const exportData = {
    projects: [{ id: "p1", name: "Backend" }],
    secrets: [{ id: "s1", key: "DB", value: "pw", note: "", projectIds: ["p1"] }],
  };
  const exportJson = JSON.stringify(exportData, null, "  ");
  let command: SmExportCommand;
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BW_SERVE;
    delete process.env.BW_NOINTERACTION;
    process.env[passwordEnv] = masterPassword;
    mockSmOrganization(accountService, organizationService, true, { isAdmin: true });
    portingApiService.export.mockResolvedValue(exportJson);
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));
    userVerificationService.verifyUser.mockResolvedValue(true);
    command = new SmExportCommand(
      portingApiService,
      organizationService,
      accountService,
      userVerificationService,
      userDecryptionOptionsService,
      logService,
    );
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-export-"));
  });

  afterEach(() => {
    delete process.env.BW_SERVE;
    delete process.env.BW_NOINTERACTION;
    delete process.env[passwordEnv];
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns the export JSON when no output is given", async () => {
    const response = await command.run(smOrgId, { passwordEnv });

    expect(response.success).toBe(true);
    expect(portingApiService.export).toHaveBeenCalledWith(smOrgId);
    expect(response.data).toEqual({ object: "string", data: exportJson });
  });

  it("writes the export to the output file", async () => {
    const output = path.join(tempDir, "export.json");

    const response = await command.run(smOrgId, { output, passwordEnv });

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({ object: "message", raw: output });
    expect(fs.readFileSync(output, "utf8")).toBe(exportJson);
  });

  it("uses a default file name when the output is a directory", async () => {
    const response = await command.run(smOrgId, { output: tempDir + path.sep, passwordEnv });

    expect(response.success).toBe(true);
    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^bitwarden_export_\d{14}\.json$/);
  });

  it("returns the export as an object under bw serve", async () => {
    process.env.BW_SERVE = "true";

    const response = await command.run(smOrgId, {
      output: path.join(tempDir, "ignored.json"),
      password: masterPassword,
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ object: "sm-export", ...exportData });
    expect(fs.readdirSync(tempDir)).toHaveLength(0);
  });

  it("rejects users who are not owners or admins", async () => {
    mockSmOrganization(accountService, organizationService, true, { isAdmin: false });

    const response = await command.run(smOrgId, { passwordEnv });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Only organization owners and admins can export Secrets Manager data.",
    );
    expect(portingApiService.export).not.toHaveBeenCalled();
  });

  it("rejects organizations without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false, { isAdmin: true });

    const response = await command.run(smOrgId, { passwordEnv });

    expect(response.success).toBe(false);
    expect(portingApiService.export).not.toHaveBeenCalled();
  });

  it("maps a 404 to a clear error", async () => {
    portingApiService.export.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, { passwordEnv });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
  describe("master password re-verification", () => {
    it("verifies the master password before fetching the export", async () => {
      const response = await command.run(smOrgId, { passwordEnv });

      expect(response.success).toBe(true);
      expect(userDecryptionOptionsService.hasMasterPasswordById$).toHaveBeenCalledWith(smUserId);
      expect(userVerificationService.verifyUser).toHaveBeenCalledWith({
        type: VerificationType.MasterPassword,
        secret: masterPassword,
      });
      expect(userVerificationService.verifyUser.mock.invocationCallOrder[0]).toBeLessThan(
        portingApiService.export.mock.invocationCallOrder[0],
      );
    });

    it("reads the master password from a password file", async () => {
      const passwordFile = path.join(tempDir, "password.txt");
      fs.writeFileSync(passwordFile, masterPassword + "\n");

      const response = await command.run(smOrgId, { passwordFile });

      expect(response.success).toBe(true);
      expect(userVerificationService.verifyUser).toHaveBeenCalledWith({
        type: VerificationType.MasterPassword,
        secret: masterPassword,
      });
    });

    it("returns an error without the path when the password file cannot be read", async () => {
      const passwordFile = path.join(tempDir, "missing.txt");

      const response = await command.run(smOrgId, { passwordFile });

      expect(response.success).toBe(false);
      expect(response.message).toBe("Could not read the master password file.");
      expect(JSON.stringify(response)).not.toContain(passwordFile);
      expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("rejects a wrong master password without fetching or echoing it", async () => {
      userVerificationService.verifyUser.mockRejectedValue(new Error("Invalid master password."));

      const response = await command.run(smOrgId, { passwordEnv });

      expect(response.success).toBe(false);
      expect(response.message).toBe("Invalid master password.");
      expect(JSON.stringify(response)).not.toContain(masterPassword);
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("rejects a failed verification without fetching", async () => {
      userVerificationService.verifyUser.mockResolvedValue(false);

      const response = await command.run(smOrgId, { passwordEnv });

      expect(response.success).toBe(false);
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("requires a password source when interaction is disabled", async () => {
      process.env.BW_NOINTERACTION = "true";

      const response = await command.run(smOrgId);

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "Master password is required. Try again in interactive mode or provide a password file or environment variable.",
      );
      expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("requires the password in the request body under bw serve", async () => {
      process.env.BW_SERVE = "true";

      const response = await command.run(smOrgId, { passwordEnv });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "Master password is required. Provide it as `password` in the request body.",
      );
      expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("rejects accounts without a master password", async () => {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));

      const response = await command.run(smOrgId, { passwordEnv });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "Exporting Secrets Manager data requires a master password. Use the web vault to export.",
      );
      expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
      expect(portingApiService.export).not.toHaveBeenCalled();
    });

    it("does not ask for the master password when the user cannot export", async () => {
      mockSmOrganization(accountService, organizationService, true, { isAdmin: false });

      await command.run(smOrgId, { passwordEnv });

      expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
    });
  });
});
