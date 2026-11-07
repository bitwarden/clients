import { mock } from "jest-mock-extended";

import { SecretVersionService, SecretVersionView } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { SecretVersionsCommand } from "./secret-versions.command";

describe("SecretVersionsCommand", () => {
  const secretVersionService = mock<SecretVersionService>();
  const secretId = "22222222-2222-2222-2222-222222222222";
  const versionId = "33333333-3333-3333-3333-333333333333";
  let command: SecretVersionsCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new SecretVersionsCommand(secretVersionService);
  });

  it("lists the previous values", async () => {
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

    const response = await command.run(smOrg, secretId.toUpperCase());

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

  it("maps a 404 to a friendly error", async () => {
    secretVersionService.getSecretVersions.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("rejects an invalid secret id", async () => {
    const response = await command.run(smOrg, "nope");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
  });
});
