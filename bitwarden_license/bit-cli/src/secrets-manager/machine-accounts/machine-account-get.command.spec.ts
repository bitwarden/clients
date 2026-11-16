import { mock } from "jest-mock-extended";

import { ServiceAccountService, ServiceAccountView } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOrg, smOtherOrgId } from "../spec/sm-test-utils";

import { MachineAccountGetCommand } from "./machine-account-get.command";

describe("MachineAccountGetCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  let command: MachineAccountGetCommand;

  const makeMachineAccount = (organizationId = smOrgId) =>
    Object.assign(new ServiceAccountView(), {
      id: machineAccountId,
      organizationId,
      name: "CI runner",
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MachineAccountGetCommand(serviceAccountService);
  });

  it("returns the machine account", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());

    const response = await command.run(smOrg, machineAccountId);

    expect(response.success).toBe(true);
    expect(serviceAccountService.getByServiceAccountId).toHaveBeenCalledWith(
      machineAccountId,
      smOrgId,
    );
    expect(response.data).toMatchObject({
      object: "sm-machine-account",
      id: machineAccountId,
      name: "CI runner",
    });
    expect(response.data).not.toHaveProperty("accessToSecrets");
  });

  it("returns not found for a machine account from another organization", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount(smOtherOrgId));

    const response = await command.run(smOrg, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("rejects an invalid machine account id", async () => {
    const response = await command.run(smOrg, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });
});
