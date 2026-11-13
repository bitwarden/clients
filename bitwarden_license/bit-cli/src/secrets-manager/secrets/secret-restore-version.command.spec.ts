import { mock } from "jest-mock-extended";

import { SecretService, SecretView } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOtherOrgId, smOrg } from "../spec/sm-test-utils";

import { SecretRestoreVersionCommand } from "./secret-restore-version.command";

describe("SecretRestoreVersionCommand", () => {
  const secretService = mock<SecretService>();
  const secretId = "22222222-2222-2222-2222-222222222222";
  const versionId = "33333333-3333-3333-3333-333333333333";
  let command: SecretRestoreVersionCommand;

  const makeSecret = (overrides: Partial<SecretView> = {}) =>
    Object.assign(new SecretView(), {
      id: secretId,
      organizationId: smOrgId,
      name: "DB_PASSWORD",
      value: "current",
      write: true,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new SecretRestoreVersionCommand(secretService);
  });

  it("restores the version", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());
    secretService.restoreVersion.mockResolvedValue(makeSecret({ value: "old value" }));

    const response = await command.run(smOrg, secretId, versionId.toUpperCase());

    expect(response.success).toBe(true);
    expect(secretService.restoreVersion).toHaveBeenCalledWith(secretId, versionId);
    expect(response.data).toMatchObject({ object: "sm-secret", value: "old value" });
  });

  it("rejects an invalid version id", async () => {
    const response = await command.run(smOrg, secretId, "nope");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });

  it("rejects a secret the user cannot write", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ write: false }));

    const response = await command.run(smOrg, secretId, versionId);

    expect(response.success).toBe(false);
    expect(secretService.restoreVersion).not.toHaveBeenCalled();
  });

  it("treats a secret from another organization as not found", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ organizationId: smOtherOrgId }));

    const response = await command.run(smOrg, secretId, versionId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
    expect(secretService.restoreVersion).not.toHaveBeenCalled();
  });

  it("maps a 404 from the restore to a missing version", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());
    secretService.restoreVersion.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, secretId, versionId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The secret version was not found, or you do not have access to it.",
    );
  });
});
