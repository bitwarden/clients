import { mock } from "jest-mock-extended";

import {
  BulkOperationStatus,
  ServiceAccountSecretsDetailsView,
  ServiceAccountService,
} from "@bitwarden/bit-sm";

import { smOrgId, smOrg } from "../spec/sm-test-utils";

import { MachineAccountDeleteCommand } from "./machine-account-delete.command";

describe("MachineAccountDeleteCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  let command: MachineAccountDeleteCommand;

  const machineAccount = Object.assign(new ServiceAccountSecretsDetailsView(), {
    id: machineAccountId,
    organizationId: smOrgId,
    name: "CI",
  });

  beforeEach(() => {
    jest.clearAllMocks();
    serviceAccountService.getServiceAccounts.mockResolvedValue([machineAccount]);
    command = new MachineAccountDeleteCommand(serviceAccountService);
  });

  it("deletes the machine account", async () => {
    serviceAccountService.delete.mockResolvedValue([
      Object.assign(new BulkOperationStatus(), { id: machineAccountId, name: "CI" }),
    ]);

    const response = await command.run(smOrg, [machineAccountId]);

    expect(response.success).toBe(true);
    expect(serviceAccountService.delete).toHaveBeenCalledWith([machineAccount]);
    expect(response.data).toMatchObject({
      data: [{ object: "sm-bulk-status", id: machineAccountId, name: "CI" }],
    });
  });

  it("rejects a machine account that is not in the organization", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrg, [unknownId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(serviceAccountService.delete).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    const response = await command.run(smOrg, ["nope"]);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
    expect(serviceAccountService.getServiceAccounts).not.toHaveBeenCalled();
  });
});
