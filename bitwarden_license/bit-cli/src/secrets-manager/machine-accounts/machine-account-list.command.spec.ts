import { mock } from "jest-mock-extended";

import { ServiceAccountSecretsDetailsView, ServiceAccountService } from "@bitwarden/bit-sm";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { MachineAccountListCommand } from "./machine-account-list.command";

describe("MachineAccountListCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  let command: MachineAccountListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MachineAccountListCommand(serviceAccountService);
  });

  it("lists the organization's machine accounts", async () => {
    const machineAccount = Object.assign(new ServiceAccountSecretsDetailsView(), {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: smOrgId,
      name: "CI runner",
      accessToSecrets: 3,
    });
    serviceAccountService.getServiceAccounts.mockResolvedValue([machineAccount]);

    const response = await command.run(smOrg);

    expect(response.success).toBe(true);
    expect(serviceAccountService.getServiceAccounts).toHaveBeenCalledWith(smOrgId, true);
    const data = (response.data as ListResponse).data as SmMachineAccountResponse[];
    expect(data[0]).toMatchObject({
      object: "sm-machine-account",
      name: "CI runner",
      accessToSecrets: 3,
    });
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getServiceAccounts.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
