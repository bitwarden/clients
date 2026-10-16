import { mock } from "jest-mock-extended";

import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { MachineAccountGetCommand } from "./machine-account-get.command";

describe("MachineAccountGetCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
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
    mockSmOrganization(accountService, organizationService);
    command = new MachineAccountGetCommand(
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("returns the machine account", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());

    const response = await command.run(smOrgId, machineAccountId);

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

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid", machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid machine account id", async () => {
    const response = await command.run(smOrgId, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("treats a machine account from another organization as not found", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount(smOtherOrgId));

    const response = await command.run(smOrgId, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });
});
