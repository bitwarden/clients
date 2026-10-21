import { mock } from "jest-mock-extended";

import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { encodeSmRequest, mockSmOrganization, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { MachineAccountCreateCommand } from "./machine-account-create.command";

describe("MachineAccountCreateCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: MachineAccountCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new MachineAccountCreateCommand(
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("creates the machine account", async () => {
    serviceAccountService.create.mockResolvedValue(
      Object.assign(new ServiceAccountView(), {
        id: "22222222-2222-2222-2222-222222222222",
        organizationId: smOrgId,
        name: "CI",
      }),
    );

    const response = await command.run(smOrgId, encodeSmRequest({ name: "CI" }));

    expect(response.success).toBe(true);
    expect(serviceAccountService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ organizationId: smOrgId, name: "CI" }),
    );
    expect(response.data).toMatchObject({ object: "sm-machine-account", name: "CI" });
  });

  it("requires a name", async () => {
    const response = await command.run(smOrgId, {});

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(serviceAccountService.create).not.toHaveBeenCalled();
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrgId, { organizationId: smOtherOrgId, name: "CI" });

    expect(response.success).toBe(false);
    expect(serviceAccountService.create).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, { name: "CI" });

    expect(response.success).toBe(false);
    expect(serviceAccountService.create).not.toHaveBeenCalled();
  });
});
