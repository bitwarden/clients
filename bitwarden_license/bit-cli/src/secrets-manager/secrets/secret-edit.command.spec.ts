import { mock } from "jest-mock-extended";

import {
  SecretProjectView,
  ProjectService,
  ProjectView,
  SecretService,
  SecretView,
} from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
// eslint-disable-next-line no-restricted-imports
import { DECRYPT_ERROR } from "@bitwarden/legacy-crypto";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { SecretEditCommand } from "./secret-edit.command";

describe("SecretEditCommand", () => {
  const secretService = mock<SecretService>();
  const projectService = mock<ProjectService>();
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
      creationDate: "2026-01-01T00:00:00.000Z",
      revisionDate: "2026-01-02T00:00:00.000Z",
      read: true,
      write: true,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    secretService.update.mockImplementation(async (_orgId, view) =>
      Object.assign(new SecretView(), view),
    );
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), {
        id: otherProjectId,
        organizationId: smOrgId,
        name: "Frontend",
      }),
    );
    command = new SecretEditCommand(secretService, projectService);
  });

  it("changes only the given properties and records a value change", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(
      smOrg,
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
      undefined,
      true,
    );
    expect(response.data).toMatchObject({ object: "sm-secret", value: "new value" });
  });

  it("does not record a value change when the value is unchanged", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    await command.run(smOrg, secretId, { key: "RENAMED", value: "hunter2" });

    expect(secretService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ name: "RENAMED", value: "hunter2" }),
      undefined,
      false,
    );
  });

  it("moves the secret to the project given as a `projects` array of { id, name } objects", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    await command.run(smOrg, secretId, { projects: [{ id: otherProjectId, name: null }] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [expect.objectContaining({ id: otherProjectId })] }),
      undefined,
      false,
    );

    await command.run(smOrg, secretId, { projects: [] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [] }),
      undefined,
      false,
    );
  });

  it("rejects `projectIds` and `projects` together", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId, {
      projectIds: [otherProjectId],
      projects: [{ id: otherProjectId }],
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Provide either `projectIds` or `projects`, not both.");
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("rejects malformed `projects` entries", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    for (const projects of ["x", [{}], [{ id: 5 }], [null], [otherProjectId]]) {
      const response = await command.run(smOrg, secretId, { projects });

      expect(response.success).toBe(false);
      expect(response.message).toBe("`projects` must be an array of objects with a project `id`.");
    }
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("names `projects[].id` when a project id is empty", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId, { projects: [{ id: "" }] });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`projects[].id` is required.");
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("accepts a full secret response body", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId, {
      object: "sm-secret",
      id: secretId,
      organizationId: smOrgId,
      key: "RENAMED",
      value: "new value",
      note: "new note",
      projects: [{ id: otherProjectId, name: "Frontend" }],
      creationDate: "2026-01-01T00:00:00.000Z",
      revisionDate: "2026-01-02T00:00:00.000Z",
      read: true,
      write: true,
    });

    expect(response.success).toBe(true);
    expect(secretService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({
        id: secretId,
        name: "RENAMED",
        value: "new value",
        note: "new note",
        projects: [expect.objectContaining({ id: otherProjectId })],
      }),
      undefined,
      true,
    );
  });

  it("moves the secret to another project, or out of all projects", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    await command.run(smOrg, secretId, { projectIds: [otherProjectId] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [expect.objectContaining({ id: otherProjectId })] }),
      undefined,
      false,
    );

    await command.run(smOrg, secretId, { projectIds: [] });
    expect(secretService.update).toHaveBeenLastCalledWith(
      smOrgId,
      expect.objectContaining({ projects: [] }),
      undefined,
      false,
    );
  });

  it("keeps the project name when the server omits an unchanged project", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());
    secretService.update.mockImplementation(async (_orgId, view) =>
      Object.assign(new SecretView(), view, { projects: undefined }),
    );

    const response = await command.run(smOrg, secretId, { note: "new" });

    expect(projectService.getByProjectId).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({ projects: [{ id: projectId, name: "Backend" }] });
  });

  it("looks up the name of a project the secret is moved to", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId, { projectIds: [otherProjectId] });

    expect(projectService.getByProjectId).toHaveBeenCalledWith(otherProjectId, true);
    expect(response.data).toMatchObject({ projects: [{ id: otherProjectId, name: "Frontend" }] });
  });

  it("rejects a secret the user cannot write", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ write: false }));

    const response = await command.run(smOrg, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("refuses to write back a value that could not be decrypted", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ note: DECRYPT_ERROR }));

    const response = await command.run(smOrg, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The secret's note could not be decrypted. Provide new values for them in the request.",
    );
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("treats a secret from another organization as not found", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ organizationId: smOtherOrgId }));

    const response = await command.run(smOrg, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getBySecretId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, secretId, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The secret was not found, or you do not have access to it.");
  });

  it("rejects an empty key", async () => {
    const response = await command.run(smOrg, secretId, { key: "" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`key` cannot be empty.");
    expect(secretService.getBySecretId).not.toHaveBeenCalled();
  });

  it.each([
    ["object", { object: "sm-project" }],
    ["id", { id: "55555555-5555-5555-5555-555555555555" }],
    ["creationDate", { creationDate: "2026-11-17T04:22:34.0716668Z" }],
    ["revisionDate", { revisionDate: "2026-11-17T04:22:34.0716668Z" }],
    ["read", { read: false }],
    ["write", { write: false }],
    ["decryptionError", { decryptionError: true }],
    ["accessToSecrets", { accessToSecrets: 1 }],
  ])("rejects a changed %s and saves nothing", async (property, change) => {
    secretService.getBySecretId.mockResolvedValue(makeSecret());

    const response = await command.run(smOrg, secretId, { value: "new value", ...change });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "`" + property + "` cannot be edited on a secret. Remove this property from the request.",
    );
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "rejects decryptionError %p, which secrets do not have, and saves nothing",
    async (decryptionError) => {
      secretService.getBySecretId.mockResolvedValue(makeSecret());

      const response = await command.run(smOrg, secretId, { value: "new value", decryptionError });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`decryptionError` cannot be edited on a secret. Remove this property from the request.",
      );
      expect(secretService.update).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "rejects decryptError %p added to the template and saves nothing",
    async (decryptError) => {
      secretService.getBySecretId.mockResolvedValue(makeSecret());

      const response = await command.run(
        smOrg,
        secretId,
        encodeSmRequest({
          organizationId: null,
          key: "SECRET_NAME",
          value: "secret value",
          note: "",
          projectIds: [projectId],
          decryptError,
        }),
      );

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`decryptError` is not a secret property. Remove this property from the request. Properties that can be edited on a secret: `key`, `value`, `note`, `projectIds`, `projects`.",
      );
      expect(secretService.getBySecretId).not.toHaveBeenCalled();
      expect(secretService.update).not.toHaveBeenCalled();
    },
  );

  it("rejects `name` and other properties secrets do not have", async () => {
    const response = await command.run(smOrg, secretId, { name: "API_KEY", notes: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "`name`, `notes` are not secret properties. Remove these properties from the request. Properties that can be edited on a secret: `key`, `value`, `note`, `projectIds`, `projects`.",
    );
    expect(secretService.update).not.toHaveBeenCalled();
  });

  it("accepts a full get-shaped body", async () => {
    const existing = makeSecret();
    secretService.getBySecretId.mockResolvedValue(existing);

    const response = await command.run(smOrg, secretId, {
      object: "sm-secret",
      id: secretId,
      organizationId: smOrgId,
      key: "DB_PASSWORD",
      value: "new value",
      note: "prod",
      projects: [{ id: projectId, name: "Backend" }],
      creationDate: existing.creationDate,
      revisionDate: existing.revisionDate,
      read: true,
      write: true,
    });

    expect(response.success).toBe(true);
    expect(secretService.update).toHaveBeenCalled();
  });

  it("reports missing edit permission before read-only properties", async () => {
    secretService.getBySecretId.mockResolvedValue(makeSecret({ write: false }));

    const response = await command.run(smOrg, secretId, { value: "new value", write: true });

    expect(response.success).toBe(false);
    expect(response.message).toBe(Response.noEditPermission().message);
    expect(secretService.update).not.toHaveBeenCalled();
  });
});
