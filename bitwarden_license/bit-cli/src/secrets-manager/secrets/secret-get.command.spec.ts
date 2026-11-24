import { mock } from "jest-mock-extended";

import { SecretService, SecretView } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOrg, smOtherOrgId } from "../spec/sm-test-utils";

import { SecretGetCommand } from "./secret-get.command";

describe("SecretGetCommand", () => {
  const secretService = mock<SecretService>();
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
    command = new SecretGetCommand(secretService);
  });

  it("returns the secret with its value", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId);

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

  it("returns not found for a secret from another organization", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret(smOtherOrgId));

    const response = await command.run(smOrg, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("rejects an invalid secret id", async () => {
    const response = await command.run(smOrg, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getBySecretId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, secretId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });
});
