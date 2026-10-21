import { mock } from "jest-mock-extended";

import { SecretProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-project.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
// eslint-disable-next-line no-restricted-imports
import { DECRYPT_ERROR } from "@bitwarden/legacy-crypto";

import {
  encodeSmRequest,
  mockSmOrganization,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
} from "../spec/sm-test-utils";

import { SecretEditCommand } from "./secret-edit.command";

describe("SecretEditCommand", () => {
  const secretService = mock<SecretService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const secretId = "22222222-2222-2222-2222-222222222222";
  const projectId = "33333333-3333-3333-3333-333333333333";
  const otherProjectId = "44444444-4444-4444-4444-444444444444";
  let command: SecretEditCommand;

  const makeSecret = (overrides: Partial<SecretView> = {}) =>
    Object.assign(new SecretView(), {
      id: secretId,
      organizationId: smOrgId,
      name: "DB_PASSWORD",
      value: "hunter2",
      note: "prod",
      projects: [Object.assign(new SecretProjectView(), { id: projectId, name: "Backend" })],
      read: true,
      write: true,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    secretService.update.mockImplementation(async (_orgId, view) =>
      Object.assign(new SecretView(), view),
    );
    command = new SecretEditCommand(secretService, organizationService, accountService);
  });

  it("changes only the given properties and records a value change", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(
      smOrgId,
      secretId.toUpperCase(),
      encodeSmRequest({ value: "new value" }),
    );

    expect(response.success).toBe(true);
    expect(secretService.getBySecretId).toHaveBeenCalledWith(secretId);
    expect(secretService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({
        id: secretId,
        name: "DB_PASSWORD",
        value: "new value",
        note: "prod",
        projects: [expect.objectContaining({ id: projectId })],
      }),
      null,
      true,
    );
    expect(response.data).toMatchObject({ object: "sm-secret", value: "new value" });
  });

  it("does not record a value change when the value is unchanged", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    await command.run(smOrgId, secretId, { key: "RENAMED", value: "hunter2" });

    expect(secretService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ name: "RENAMED", value: "hunter2" }),
      null,
      false,
    );
  });

  it("moves the secret to another project, or out of all projects", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    await command.run(smOrgId, secretId, { projectIds: [otherProjectId] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [expect.objectContaining({ id: otherProjectId })] }),
      null,
      false,
    );

    await command.run(smOrgId, secretId, { projectIds: [] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [] }),
      null,
      false,
    );
  });

  it("rejects a secret the user cannot write", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ write: false }));

    const response = await command.run(smOrgId, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("refuses to write back a value that could not be decrypted", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ note: DECRYPT_ERROR }));

    const response = await command.run(smOrgId, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The secret's note could not be decrypted. Provide new values for them in the request.",
    );
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("treats a secret from another organization as not found", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ organizationId: smOtherOrgId }));

    const response = await command.run(smOrgId, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getBySecretId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("rejects an empty key", async () => {
    const response = await command.run(smOrgId, secretId, { key: "" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`key` cannot be empty.");
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });
});
