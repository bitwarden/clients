import { mock } from "jest-mock-extended";

import { SecretVersionView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-version.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { SecretVersionService } from "@bitwarden/bit-common/secrets-manager/secrets/secret-version.service";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { SecretVersionsCommand } from "./secret-versions.command";

describe("SecretVersionsCommand", () => {
  const secretService = mock<SecretService>();
  const secretVersionService = mock<SecretVersionService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const secretId = "22222222-2222-2222-2222-222222222222";
  const versionId = "33333333-3333-3333-3333-333333333333";
  let command: SecretVersionsCommand;

  const makeSecret = (organizationId = smOrgId) =>
    Object.assign(new SecretView(), { id: secretId, organizationId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new SecretVersionsCommand(
      secretService,
      secretVersionService,
      organizationService,
      accountService,
    );
  });

  it("lists the previous values", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());
    secretVersionService.getSecretVersions.mockResolvedValue({
      currentValueDate: "2026-02-01T00:00:00Z",
      versions: [
        new SecretVersionView({
          id: versionId,
          secretId,
          value: "old value",
          versionDate: "2026-01-01T00:00:00Z",
          authorName: "Alice",
        }),
      ],
    });

    const response = await command.run(smOrgId, secretId.toUpperCase());

    expect(response.success).toBe(true);
    expect(secretVersionService.getSecretVersions).toHaveBeenCalledWith(smOrgId, secretId);
    expect(response.data).toMatchObject({
      object: "list",
      data: [
        {
          object: "sm-secret-version",
          id: versionId,
          secretId,
          value: "old value",
          versionDate: "2026-01-01T00:00:00Z",
          authorName: "Alice",
        },
      ],
    });
  });

  it("treats a secret from another organization as not found", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret(smOtherOrgId));

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
    expect(secretVersionService.getSecretVersions).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getBySecretId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("rejects an invalid secret id", async () => {
    const response = await command.run(smOrgId, "nope");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
  });
});
