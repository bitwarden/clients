import { mock } from "jest-mock-extended";

import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { TrashRestoreCommand } from "./trash-restore.command";

describe("TrashRestoreCommand", () => {
  const secretService = mock<SecretService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const firstId = "22222222-2222-2222-2222-222222222222";
  const secondId = "33333333-3333-3333-3333-333333333333";
  let command: TrashRestoreCommand;

  const trashed = [
    Object.assign(new SecretListView(), { id: firstId, organizationId: smOrgId, name: "A" }),
    Object.assign(new SecretListView(), { id: secondId, organizationId: smOrgId, name: "B" }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    secretService.getTrashedSecrets.mockResolvedValue(trashed);
    command = new TrashRestoreCommand(secretService, organizationService, accountService);
  });

  it("applies to the given trashed secrets", async () => {
    const response = await command.run(smOrgId, { secretIds: [secondId.toUpperCase()] });

    expect(response.success).toBe(true);
    expect(secretService.restoreTrashed).toHaveBeenCalledWith(smOrgId, [secondId]);
    expect(secretService.deleteTrashed).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({
      object: "list",
      data: [{ object: "sm-bulk-status", id: secondId, name: "B" }],
    });
  });

  it("applies to every trashed secret with --all", async () => {
    const response = await command.run(smOrgId, { all: true });

    expect(response.success).toBe(true);
    expect(secretService.restoreTrashed).toHaveBeenCalledWith(smOrgId, [firstId, secondId]);
  });

  it("does nothing when --all is given and the trash is empty", async () => {
    secretService.getTrashedSecrets.mockResolvedValue([]);

    const response = await command.run(smOrgId, { all: true });

    expect(response.success).toBe(true);
    expect(secretService.restoreTrashed).not.toHaveBeenCalled();
  });

  it("requires ids or --all", async () => {
    const response = await command.run(smOrgId, { secretIds: [] });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Provide one or more secret ids, or `--all`.");
    expect(secretService.getTrashedSecrets).not.toHaveBeenCalled();
  });

  it("rejects ids together with --all", async () => {
    const response = await command.run(smOrgId, { secretIds: [firstId], all: true });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Provide secret ids or `--all`, not both.");
    expect(secretService.restoreTrashed).not.toHaveBeenCalled();
  });

  it("rejects a secret that is not in the trash", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrgId, { secretIds: [firstId, unknownId] });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The trashed secret `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(secretService.restoreTrashed).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getTrashedSecrets.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, { all: true });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
