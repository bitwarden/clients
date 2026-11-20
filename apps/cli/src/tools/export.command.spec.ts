import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

import { Response } from "../models/response";
import { CliUtils } from "../utils";

import { ExportCommand } from "./export.command";

jest.mock("inquirer", () => {
  return {
    createPromptModule: jest.fn(() => jest.fn(() => Promise.resolve({ password: "prompted-pw" }))),
  };
});

describe("ExportCommand", () => {
  let exportService: MockProxy<VaultExportServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let accountService: MockProxy<AccountService>;
  let configService: MockProxy<ConfigService>;
  let command: ExportCommand;

  const userId = "user-id" as UserId;
  const orgId = "cf14adc3-aca5-4573-890a-f6fa231436d9" as OrganizationId;
  const otherOrgId = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" as OrganizationId;

  const textExport = () => ({
    type: "text/plain" as const,
    data: "name,login\nexample,user",
    fileName: "bitwarden_export.csv",
  });

  const zipExport = () => ({
    type: "application/zip" as const,
    data: new Blob([new Uint8Array([1, 2, 3])]),
    fileName: "bitwarden_export.zip",
  });

  beforeEach(() => {
    exportService = mock<VaultExportServiceAbstraction>();
    policyService = mock<PolicyService>();
    eventCollectionService = mock<EventCollectionService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();

    command = new ExportCommand(
      exportService,
      policyService,
      eventCollectionService,
      accountService,
      configService,
    );

    accountService.activeAccount$ = of({ id: userId } as Account);
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    configService.getFeatureFlag.mockResolvedValue(false);
    exportService.getExport.mockResolvedValue(textExport());
    exportService.getOrganizationExport.mockResolvedValue(textExport());
    eventCollectionService.collect.mockResolvedValue(undefined);

    jest.spyOn(CliUtils, "saveResultToFile").mockResolvedValue(Response.success());
    jest.spyOn(CliUtils, "writeLn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.BW_QUIET;
  });

  describe("personal export", () => {
    it("exports the personal vault as csv by default and saves the file", async () => {
      const response = await command.run({ output: "out.csv" });

      expect(exportService.getExport).toHaveBeenCalledWith(userId, "csv", undefined);
      expect(exportService.getOrganizationExport).not.toHaveBeenCalled();
      expect(CliUtils.saveResultToFile).toHaveBeenCalledWith(
        "name,login\nexample,user",
        "out.csv",
        "bitwarden_export.csv",
      );
      expect(response.success).toBe(true);
    });

    it("logs a user export event", async () => {
      await command.run({});

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.User_ClientExportedVault,
        null,
        true,
        undefined,
      );
    });

    it("returns a bad request when a policy disables personal vault export", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const response = await command.run({});

      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.DisablePersonalVaultExport,
        userId,
      );
      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "One or more organization policies prevents you from exporting your personal vault.",
      );
      expect(exportService.getExport).not.toHaveBeenCalled();
      expect(CliUtils.saveResultToFile).not.toHaveBeenCalled();
    });

    it("returns an error when the export service fails", async () => {
      exportService.getExport.mockRejectedValue(new Error("export failed"));

      const response = await command.run({});

      expect(response.success).toBe(false);
      expect(response.message).toContain("export failed");
      expect(eventCollectionService.collect).not.toHaveBeenCalled();
      expect(CliUtils.saveResultToFile).not.toHaveBeenCalled();
    });
  });

  describe("organization export", () => {
    it("exports the organization vault when an organization id is provided", async () => {
      const response = await command.run({ organizationid: orgId, output: "out.csv" });

      expect(exportService.getOrganizationExport).toHaveBeenCalledWith(
        userId,
        orgId,
        "csv",
        undefined,
      );
      expect(exportService.getExport).not.toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("logs an organization export event with the organization id", async () => {
      await command.run({ organizationid: orgId });

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Organization_ClientExportedVault,
        null,
        true,
        orgId,
      );
    });

    it("does not apply the personal vault export policy to organization exports", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const response = await command.run({ organizationid: orgId });

      expect(exportService.getOrganizationExport).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("returns an error when the organization id is not a GUID", async () => {
      const response = await command.run({ organizationid: "not-a-guid" });

      expect(response.success).toBe(false);
      expect(response.message).toBe("`not-a-guid` is not a GUID.");
      expect(exportService.getOrganizationExport).not.toHaveBeenCalled();
      expect(exportService.getExport).not.toHaveBeenCalled();
    });
  });

  describe("export formats", () => {
    it("rejects an unsupported format", async () => {
      const response = await command.run({ format: "xml" });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "'xml' is not a supported export format. Supported formats: csv, json, encrypted_json, zip.",
      );
      expect(exportService.getExport).not.toHaveBeenCalled();
    });

    it("uses encrypted_json when json is requested with a password", async () => {
      await command.run({ format: "json", password: "file-password" });

      expect(exportService.getExport).toHaveBeenCalledWith(
        userId,
        "encrypted_json",
        "file-password",
      );
    });

    it("keeps json when no password is provided", async () => {
      await command.run({ format: "json" });

      expect(exportService.getExport).toHaveBeenCalledWith(userId, "json", undefined);
    });

    it("uses the password passed as a string without prompting", async () => {
      await command.run({ format: "encrypted_json", password: "file-password" });

      expect(exportService.getExport).toHaveBeenCalledWith(
        userId,
        "encrypted_json",
        "file-password",
      );
    });

    it("prompts for the password when the password flag has no value", async () => {
      const response = await command.run({ format: "encrypted_json", password: true });

      expect(exportService.getExport).toHaveBeenCalledWith(userId, "encrypted_json", "prompted-pw");
      expect(response.success).toBe(true);
    });

    it("saves zip exports using the blob contents", async () => {
      const zip = zipExport();
      exportService.getExport.mockResolvedValue(zip);

      await command.run({ format: "zip", output: "out.zip" });

      expect(CliUtils.saveResultToFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        "out.zip",
        "bitwarden_export.zip",
      );
      const savedBuffer = (CliUtils.saveResultToFile as jest.Mock).mock.calls[0][0] as Buffer;
      expect(Array.from(savedBuffer)).toEqual([1, 2, 3]);
    });

    it("returns an error when saving the file fails", async () => {
      jest.spyOn(CliUtils, "saveResultToFile").mockRejectedValue(new Error("disk full"));

      const response = await command.run({});

      expect(response.success).toBe(false);
      expect(response.message).toContain("disk full");
    });
  });

  describe("VFO1 foundation feature flag", () => {
    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(true);
    });

    it("exports the vault identified by --vaultid", async () => {
      await command.run({ vaultid: orgId });

      expect(exportService.getOrganizationExport).toHaveBeenCalledWith(
        userId,
        orgId,
        "csv",
        undefined,
      );
    });

    it("prefers --vaultid over the deprecated --organizationid", async () => {
      await command.run({ vaultid: orgId, organizationid: otherOrgId });

      expect(exportService.getOrganizationExport).toHaveBeenCalledWith(
        userId,
        orgId,
        "csv",
        undefined,
      );
    });

    it("falls back to --organizationid when --vaultid is not provided", async () => {
      await command.run({ organizationid: otherOrgId });

      expect(exportService.getOrganizationExport).toHaveBeenCalledWith(
        userId,
        otherOrgId,
        "csv",
        undefined,
      );
    });

    it("returns an error when --vaultid is not a GUID", async () => {
      const response = await command.run({ vaultid: "not-a-guid" });

      expect(response.success).toBe(false);
      expect(response.message).toBe("`not-a-guid` is not a GUID.");
      expect(exportService.getOrganizationExport).not.toHaveBeenCalled();
    });

    it("applies the personal export policy when neither vault option is provided", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      const response = await command.run({});

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "One or more organization policies prevents you from exporting your personal vault.",
      );
    });

    it("writes a deprecation warning to stderr when --organizationid is used", async () => {
      await command.run({ organizationid: orgId });

      expect(CliUtils.writeLn).toHaveBeenCalledWith(
        "--organizationid is deprecated and will be removed in a future CLI release. Use --vaultid instead",
        false,
        true,
      );
    });

    it("does not write the deprecation warning when --vaultid is used", async () => {
      await command.run({ vaultid: orgId });

      expect(CliUtils.writeLn).not.toHaveBeenCalled();
    });

    it("suppresses the deprecation warning when BW_QUIET is true", async () => {
      process.env.BW_QUIET = "true";

      await command.run({ organizationid: orgId });

      expect(CliUtils.writeLn).not.toHaveBeenCalled();
    });
  });

  describe("VFO1 foundation feature flag disabled", () => {
    it("ignores --vaultid and exports the personal vault", async () => {
      const response = await command.run({ vaultid: orgId });

      expect(exportService.getExport).toHaveBeenCalledWith(userId, "csv", undefined);
      expect(exportService.getOrganizationExport).not.toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it("does not write the deprecation warning when --organizationid is used", async () => {
      await command.run({ organizationid: orgId });

      expect(CliUtils.writeLn).not.toHaveBeenCalled();
    });
  });
});
