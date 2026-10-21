import { mock } from "jest-mock-extended";

import { ServiceAccountSecretsDetailsView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { MachineAccountListCommand } from "./machine-account-list.command";

describe("MachineAccountListCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: MachineAccountListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new MachineAccountListCommand(
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("lists the organization's machine accounts", async () => {
    const machineAccount = Object.assign(new ServiceAccountSecretsDetailsView(), {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: smOrgId,
      name: "CI runner",
      accessToSecrets: 3,
    });
    serviceAccountService.getServiceAccounts.mockResolvedValue([machineAccount]);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(true);
    expect(serviceAccountService.getServiceAccounts).toHaveBeenCalledWith(smOrgId, true);
    const data = (response.data as ListResponse).data as SmMachineAccountResponse[];
    expect(data[0]).toMatchObject({
      object: "sm-machine-account",
      name: "CI runner",
      accessToSecrets: 3,
    });
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(serviceAccountService.getServiceAccounts).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getServiceAccounts.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
