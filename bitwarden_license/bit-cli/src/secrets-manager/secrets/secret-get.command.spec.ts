import { mock } from "jest-mock-extended";

import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { SecretGetCommand } from "./secret-get.command";

describe("SecretGetCommand", () => {
  const secretService = mock<SecretService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const secretId = "22222222-2222-2222-2222-222222222222";
  let command: SecretGetCommand;

  const makeSecret = (organizationId = smOrgId) =>
    Object.assign(new SecretView(), {
      id: secretId,
      organizationId,
      name: "DB_PASSWORD",
      value: "hunter2",
      note: "rotate monthly",
      projects: [],
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new SecretGetCommand(secretService, organizationService, accountService);
  });

  it("returns the secret with its value", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(true);
    expect(secretService.getBySecretId).toHaveBeenCalledWith(secretId);
    expect(response.data).toMatchObject({
      object: "sm-secret",
      id: secretId,
      key: "DB_PASSWORD",
      value: "hunter2",
      note: "rotate monthly",
    });
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid", secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid secret id", async () => {
    const response = await command.run(smOrgId, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getBySecretId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("treats a secret from another organization as not found", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret(smOtherOrgId));

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });
});
