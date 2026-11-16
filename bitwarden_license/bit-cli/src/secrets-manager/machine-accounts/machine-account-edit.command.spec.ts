import { mock } from "jest-mock-extended";

import { ServiceAccountService, ServiceAccountView } from "@bitwarden/bit-sm";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { MachineAccountEditCommand } from "./machine-account-edit.command";

describe("MachineAccountEditCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  let command: MachineAccountEditCommand;

  const makeMachineAccount = (overrides: Partial<ServiceAccountView> = {}) =>
    Object.assign(new ServiceAccountView(), {
      id: machineAccountId,
      organizationId: smOrgId,
      name: "CI",
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MachineAccountEditCommand(serviceAccountService);
  });

  it("renames the machine account", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());
    serviceAccountService.update.mockResolvedValue(makeMachineAccount({ name: "Deploy" }));

    const response = await command.run(
      smOrg,
      machineAccountId.toUpperCase(),
      encodeSmRequest({ name: "Deploy" }),
    );

    expect(response.success).toBe(true);
    expect(serviceAccountService.update).toHaveBeenCalledWith(
      machineAccountId,
      smOrgId,
      expect.objectContaining({ id: machineAccountId, name: "Deploy" }),
    );
    expect(response.data).toMatchObject({ object: "sm-machine-account", name: "Deploy" });
  });

  it("treats a machine account from another organization as not found", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      makeMachineAccount({ organizationId: smOtherOrgId }),
    );

    const response = await command.run(smOrg, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(serviceAccountService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("requires a name", async () => {
    const response = await command.run(smOrg, machineAccountId, { name: "  " });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });
});
