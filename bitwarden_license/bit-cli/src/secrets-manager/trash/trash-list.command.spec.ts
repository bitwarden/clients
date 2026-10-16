import { mock } from "jest-mock-extended";

import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SmSecretResponse } from "../models/sm-secret.response";
import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { TrashListCommand } from "./trash-list.command";

describe("TrashListCommand", () => {
  const secretService = mock<SecretService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: TrashListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new TrashListCommand(secretService, organizationService, accountService);
  });

  it("lists the trashed secrets", async () => {
    const secret = Object.assign(new SecretListView(), {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: smOrgId,
      name: "OLD_TOKEN",
      projects: [],
    });
    secretService.getTrashedSecrets.mockResolvedValue([secret]);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(true);
    expect(secretService.getTrashedSecrets).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmSecretResponse[];
    expect(data[0]).toMatchObject({ object: "sm-secret", key: "OLD_TOKEN" });
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
    expect(secretService.getTrashedSecrets).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getTrashedSecrets.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
