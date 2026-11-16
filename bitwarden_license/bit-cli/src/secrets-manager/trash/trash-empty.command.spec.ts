import { mock } from "jest-mock-extended";

import { SecretListView, SecretService } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { TrashEmptyCommand } from "./trash-empty.command";

describe("TrashEmptyCommand", () => {
  const secretService = mock<SecretService>();
  const firstId = "22222222-2222-2222-2222-222222222222";
  const secondId = "33333333-3333-3333-3333-333333333333";
  let command: TrashEmptyCommand;

  const trashed = [
    Object.assign(new SecretListView(), { id: firstId, organizationId: smOrgId, name: "A" }),
    Object.assign(new SecretListView(), { id: secondId, organizationId: smOrgId, name: "B" }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    secretService.getTrashedSecrets.mockResolvedValue(trashed);
    command = new TrashEmptyCommand(secretService);
  });

  it("applies to the given trashed secrets", async () => {
    const response = await command.run(smOrg, { secretIds: [secondId.toUpperCase()] });

    expect(response.success).toBe(true);
    expect(secretService.deleteTrashed).toHaveBeenCalledWith(smOrgId, [secondId]);
    expect(secretService.restoreTrashed).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({
      object: "list",
      data: [{ object: "sm-bulk-status", id: secondId, name: "B" }],
    });
  });

  it("applies to every trashed secret with --all", async () => {
    const response = await command.run(smOrg, { all: true });

    expect(response.success).toBe(true);
    expect(secretService.deleteTrashed).toHaveBeenCalledWith(smOrgId, [firstId, secondId]);
  });

  it("does nothing when --all is given and the trash is empty", async () => {
    secretService.getTrashedSecrets.mockResolvedValue([]);

    const response = await command.run(smOrg, { all: true });

    expect(response.success).toBe(true);
    expect(secretService.deleteTrashed).not.toHaveBeenCalled();
  });

  it("requires ids or --all", async () => {
    const response = await command.run(smOrg, { secretIds: [] });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Provide one or more secret ids, or `--all`.");
    expect(secretService.getTrashedSecrets).not.toHaveBeenCalled();
  });

  it("rejects ids together with --all", async () => {
    const response = await command.run(smOrg, { secretIds: [firstId], all: true });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Provide secret ids or `--all`, not both.");
    expect(secretService.deleteTrashed).not.toHaveBeenCalled();
  });

  it("rejects a secret that is not in the trash", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrg, { secretIds: [firstId, unknownId] });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The trashed secret `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(secretService.deleteTrashed).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getTrashedSecrets.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, { all: true });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
