import { mock } from "jest-mock-extended";

import { PotentialGranteeView } from "@bitwarden/bit-common/secrets-manager/models/view/access-policies/potential-grantee.view";
import { AccessPolicyService } from "@bitwarden/bit-common/secrets-manager/shared/access-policies/access-policy.service";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SmGranteeResponse } from "../models/sm-grantee.response";
import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { GranteesListCommand } from "./grantees-list.command";

describe("GranteesListCommand", () => {
  const accessPolicyService = mock<AccessPolicyService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: GranteesListCommand;

  const grantee = (type: string, name: string) =>
    Object.assign(new PotentialGranteeView(), {
      id: "22222222-2222-2222-2222-222222222222",
      type,
      name,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new GranteesListCommand(accessPolicyService, organizationService, accountService);
  });

  it("lists people grantees", async () => {
    accessPolicyService.getPeoplePotentialGrantees.mockResolvedValue([
      Object.assign(grantee("user", "Alice"), { email: "alice@example.com" }),
      grantee("group", "Engineering"),
    ]);

    const response = await command.run(smOrgId, "people");

    expect(response.success).toBe(true);
    expect(accessPolicyService.getPeoplePotentialGrantees).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmGranteeResponse[];
    expect(data.map((g) => [g.object, g.type, g.name])).toEqual([
      ["sm-grantee", "user", "Alice"],
      ["sm-grantee", "group", "Engineering"],
    ]);
  });

  it("lists machine account grantees with the user-facing type name", async () => {
    accessPolicyService.getServiceAccountsPotentialGrantees.mockResolvedValue([
      grantee("serviceAccount", "CI runner"),
    ]);

    const response = await command.run(smOrgId, "machine-accounts");

    expect(response.success).toBe(true);
    const data = (response.data as ListResponse).data as SmGranteeResponse[];
    expect(data[0].type).toBe("machineAccount");
  });

  it("lists project grantees", async () => {
    accessPolicyService.getProjectsPotentialGrantees.mockResolvedValue([
      grantee("project", "Backend"),
    ]);

    const response = await command.run(smOrgId, "projects");

    expect(response.success).toBe(true);
    expect(accessPolicyService.getProjectsPotentialGrantees).toHaveBeenCalledWith(smOrgId);
  });

  it("rejects an unknown grantee type", async () => {
    const response = await command.run(smOrgId, "robots");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Unknown grantee type `robots`. Expected one of: people, machine-accounts, projects.",
    );
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid", "people");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, "people");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(accessPolicyService.getPeoplePotentialGrantees).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    accessPolicyService.getPeoplePotentialGrantees.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, "people");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
