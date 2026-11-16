import { mock } from "jest-mock-extended";

import { AccessPolicyService, PotentialGranteeView } from "@bitwarden/bit-sm";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmGranteeResponse } from "../models/sm-grantee.response";
import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { GranteesListCommand } from "./grantees-list.command";

describe("GranteesListCommand", () => {
  const accessPolicyService = mock<AccessPolicyService>();
  let command: GranteesListCommand;

  const grantee = (type: string, name: string) =>
    Object.assign(new PotentialGranteeView(), {
      id: "22222222-2222-2222-2222-222222222222",
      type,
      name,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new GranteesListCommand(accessPolicyService);
  });

  it("lists people grantees", async () => {
    accessPolicyService.getPeoplePotentialGrantees.mockResolvedValue([
      Object.assign(grantee("user", "Alice"), { email: "alice@example.com" }),
      grantee("group", "Engineering"),
    ]);

    const response = await command.run(smOrg, "people");

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

    const response = await command.run(smOrg, "machine-accounts");

    expect(response.success).toBe(true);
    const data = (response.data as ListResponse).data as SmGranteeResponse[];
    expect(data[0].type).toBe("machineAccount");
  });

  it("lists project grantees", async () => {
    accessPolicyService.getProjectsPotentialGrantees.mockResolvedValue([
      grantee("project", "Backend"),
    ]);

    const response = await command.run(smOrg, "projects");

    expect(response.success).toBe(true);
    expect(accessPolicyService.getProjectsPotentialGrantees).toHaveBeenCalledWith(smOrgId);
  });

  it("rejects an unknown grantee type", async () => {
    const response = await command.run(smOrg, "robots");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Unknown grantee type `robots`. Expected one of: people, machine-accounts, projects.",
    );
  });

  it("maps a 404 to a friendly error", async () => {
    accessPolicyService.getPeoplePotentialGrantees.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, "people");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
