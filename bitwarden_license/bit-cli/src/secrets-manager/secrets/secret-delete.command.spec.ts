import { mock } from "jest-mock-extended";

import { BulkOperationStatus, SecretListView, SecretService } from "@bitwarden/bit-sm";

import { smOrgId, smOrg } from "../spec/sm-test-utils";

import { SecretDeleteCommand } from "./secret-delete.command";

describe("SecretDeleteCommand", () => {
  const secretService = mock<SecretService>();
  const firstId = "22222222-2222-2222-2222-222222222222";
  const secondId = "33333333-3333-3333-3333-333333333333";
  let command: SecretDeleteCommand;

  const secrets = [
    Object.assign(new SecretListView(), { id: firstId, organizationId: smOrgId, name: "A" }),
    Object.assign(new SecretListView(), { id: secondId, organizationId: smOrgId, name: "B" }),
  ];
  const status = (id: string, name: string, errorMessage?: string) =>
    Object.assign(new BulkOperationStatus(), { id, name, errorMessage });

  beforeEach(() => {
    jest.clearAllMocks();
    secretService.getSecrets.mockResolvedValue(secrets);
    command = new SecretDeleteCommand(secretService);
  });

  it("moves several secrets to the trash", async () => {
    secretService.delete.mockResolvedValue([status(firstId, "A"), status(secondId, "B")]);

    const response = await command.run(smOrg, [firstId, secondId]);

    expect(response.success).toBe(true);
    expect(secretService.delete).toHaveBeenCalledWith(secrets);
    expect(response.data).toMatchObject({
      data: [
        { object: "sm-bulk-status", id: firstId },
        { object: "sm-bulk-status", id: secondId },
      ],
    });
  });

  it("reports secrets that could not be deleted", async () => {
    secretService.delete.mockResolvedValue([
      status(firstId, "A"),
      status(secondId, "B", "Access denied."),
    ]);

    const response = await command.run(smOrg, [firstId, secondId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "1 of 2 could not be deleted.\nB (" + secondId + "): Access denied.",
    );
  });

  it("rejects a secret that is not in the organization", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrg, [unknownId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The secret `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(secretService.delete).not.toHaveBeenCalled();
  });
});
