import { mock } from "jest-mock-extended";

import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import {
  encodeSmRequest,
  mockSmOrganization,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
} from "../spec/sm-test-utils";

import { MachineAccountEditCommand } from "./machine-account-edit.command";

describe("MachineAccountEditCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
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
    mockSmOrganization(accountService, organizationService);
    command = new MachineAccountEditCommand(
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("renames the machine account", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());
    serviceAccountService.update.mockResolvedValue(makeMachineAccount({ name: "Deploy" }));

    const response = await command.run(
      smOrgId,
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

    const response = await command.run(smOrgId, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(serviceAccountService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("requires a name", async () => {
    const response = await command.run(smOrgId, machineAccountId, { name: "  " });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });
});
