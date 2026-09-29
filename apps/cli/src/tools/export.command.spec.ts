import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { UserId } from "@bitwarden/common/types/guid";
import { ExportedVault, VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

import { Response } from "../models/response";
import { CliUtils } from "../utils";

import { ExportCommand } from "./export.command";

describe("ExportCommand", () => {
  const userId = "user-1" as UserId;
  const organizationId = "7063feab-4b10-472e-b64c-785e2b870b92";
  const exported: ExportedVault = { type: "text/plain", data: "{}", fileName: "export.json" };

  let exportService: MockProxy<VaultExportServiceAbstraction>;
  let command: ExportCommand;

  beforeEach(() => {
    exportService = mock<VaultExportServiceAbstraction>();
    exportService.getExport.mockResolvedValue(exported);
    exportService.getOrganizationExport.mockResolvedValue(exported);

    const policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    jest.spyOn(CliUtils, "saveResultToFile").mockResolvedValue(Response.success());

    command = new ExportCommand(
      exportService,
      policyService,
      mock<EventCollectionService>(),
      accountService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects an account restricted export of the individual vault", async () => {
    const response = await command.run({ format: "encrypted_json" });

    expect(response.success).toBe(false);
    expect(response.message).toContain("Account restricted export is not supported");
    expect(exportService.getExport).not.toHaveBeenCalled();
  });

  it("creates a password protected export of the individual vault", async () => {
    const response = await command.run({ format: "encrypted_json", password: "secret" });

    expect(response.success).toBe(true);
    expect(exportService.getExport).toHaveBeenCalledWith(userId, "encrypted_json", "secret");
  });

  it("creates an account restricted export of an organization vault", async () => {
    const response = await command.run({
      format: "encrypted_json",
      organizationid: organizationId,
    });

    expect(response.success).toBe(true);
    expect(exportService.getOrganizationExport).toHaveBeenCalledWith(
      userId,
      organizationId,
      "encrypted_json",
      null,
    );
  });
});
