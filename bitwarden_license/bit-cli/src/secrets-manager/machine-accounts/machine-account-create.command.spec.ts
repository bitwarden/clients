import { mock } from "jest-mock-extended";

import { ServiceAccountService, ServiceAccountView } from "@bitwarden/bit-sm";

import { encodeSmRequest, smOrgId, smOtherOrgId, smOrg } from "../spec/sm-test-utils";

import { MachineAccountCreateCommand } from "./machine-account-create.command";

describe("MachineAccountCreateCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  let command: MachineAccountCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MachineAccountCreateCommand(serviceAccountService);
  });

  it("creates the machine account", async () => {
    serviceAccountService.create.mockResolvedValue(
      Object.assign(new ServiceAccountView(), {
        id: "22222222-2222-2222-2222-222222222222",
        organizationId: smOrgId,
        name: "CI",
      }),
    );

    const response = await command.run(smOrg, encodeSmRequest({ name: "CI" }));

    expect(response.success).toBe(true);
    expect(serviceAccountService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ organizationId: smOrgId, name: "CI" }),
    );
    expect(response.data).toMatchObject({ object: "sm-machine-account", name: "CI" });
  });

  it("requires a name", async () => {
    const response = await command.run(smOrg, {});

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(serviceAccountService.create).not.toHaveBeenCalled();
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrg, { organizationId: smOtherOrgId, name: "CI" });

    expect(response.success).toBe(false);
    expect(serviceAccountService.create).not.toHaveBeenCalled();
  });
});
