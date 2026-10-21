import { mock } from "jest-mock-extended";

import { BulkOperationStatus } from "@bitwarden/bit-common/secrets-manager/models/bulk-operation-status";
import { ServiceAccountSecretsDetailsView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smOrgId } from "../spec/sm-test-utils";

import { MachineAccountDeleteCommand } from "./machine-account-delete.command";

describe("MachineAccountDeleteCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  let command: MachineAccountDeleteCommand;

  const machineAccount = Object.assign(new ServiceAccountSecretsDetailsView(), {
    id: machineAccountId,
    organizationId: smOrgId,
    name: "CI",
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    serviceAccountService.getServiceAccounts.mockResolvedValue([machineAccount]);
    command = new MachineAccountDeleteCommand(
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("deletes the machine account", async () => {
    serviceAccountService.delete.mockResolvedValue([
      Object.assign(new BulkOperationStatus(), { id: machineAccountId, name: "CI" }),
    ]);

    const response = await command.run(smOrgId, [machineAccountId]);

    expect(response.success).toBe(true);
    expect(serviceAccountService.delete).toHaveBeenCalledWith([machineAccount]);
    expect(response.data).toMatchObject({
      data: [{ object: "sm-bulk-status", id: machineAccountId, name: "CI" }],
    });
  });

  it("rejects a machine account that is not in the organization", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrgId, [unknownId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(serviceAccountService.delete).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    const response = await command.run(smOrgId, ["nope"]);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
    expect(serviceAccountService.getServiceAccounts).not.toHaveBeenCalled();
  });
});
