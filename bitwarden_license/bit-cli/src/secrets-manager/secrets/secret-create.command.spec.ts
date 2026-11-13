import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView, SecretService, SecretView } from "@bitwarden/bit-sm";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { SecretCreateCommand } from "./secret-create.command";

describe("SecretCreateCommand", () => {
  const secretService = mock<SecretService>();
  const projectService = mock<ProjectService>();
  const projectId = "33333333-3333-3333-3333-333333333333";
  let command: SecretCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    secretService.create.mockImplementation(async (_orgId, view) =>
      Object.assign(new SecretView(), view, { id: "22222222-2222-2222-2222-222222222222" }),
    );
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOrgId, name: "Backend" }),
    );
    command = new SecretCreateCommand(secretService, projectService);
  });

  it("creates the secret in a project without changing access policies", async () => {
    const response = await command.run(
      smOrg,
      encodeSmRequest({
        organizationId: smOrgId,
        key: "DB_PASSWORD",
        value: "hunter2",
        note: "prod",
        projectIds: [projectId.toUpperCase()],
      }),
    );

    expect(response.success).toBe(true);
    expect(secretService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({
        organizationId: smOrgId,
        name: "DB_PASSWORD",
        value: "hunter2",
        note: "prod",
        projects: [expect.objectContaining({ id: projectId })],
      }),
      undefined,
    );
    expect(response.data).toMatchObject({
      object: "sm-secret",
      key: "DB_PASSWORD",
      value: "hunter2",
    });
  });

  it("fills in project names the server leaves null", async () => {
    const response = await command.run(smOrg, { key: "K", projectIds: [projectId] });

    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(response.data).toMatchObject({ projects: [{ id: projectId, name: "Backend" }] });
  });

  it("does not look up projects that the response already names", async () => {
    secretService.create.mockImplementation(async (_orgId, view) =>
      Object.assign(new SecretView(), view, {
        projects: [{ id: projectId, name: "Backend", decryptionError: false }],
      }),
    );

    const response = await command.run(smOrg, { key: "K", projectIds: [projectId] });

    expect(projectService.getByProjectId).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({ projects: [{ id: projectId, name: "Backend" }] });
  });

  it("does not use the name of a project from another organization", async () => {
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), {
        id: projectId,
        organizationId: smOtherOrgId,
        name: "Foreign",
      }),
    );

    const response = await command.run(smOrg, { key: "K", projectIds: [projectId] });

    expect(response.data).toMatchObject({ projects: [{ id: projectId, name: null }] });
  });

  it("defaults the value and note to empty strings", async () => {
    await command.run(smOrg, { key: "EMPTY" });

    expect(secretService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ name: "EMPTY", value: "", note: "", projects: [] }),
      undefined,
    );
  });

  it("requires a key", async () => {
    const response = await command.run(smOrg, { value: "x" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`key` is required.");
    expect(secretService.create).not.toHaveBeenCalled();
  });

  it("rejects more than one project", async () => {
    const response = await command.run(smOrg, {
      key: "A",
      projectIds: [projectId, "44444444-4444-4444-4444-444444444444"],
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe("A secret can only be assigned to one project.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, { key: "A", projectIds: ["nope"] });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
  });

  it("rejects a non-string value", async () => {
    const response = await command.run(smOrg, { key: "A", value: 42 });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`value` must be a string.");
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrg, { organizationId: smOtherOrgId, key: "A" });

    expect(response.success).toBe(false);
    expect(secretService.create).not.toHaveBeenCalled();
  });

  it("maps a 404 for a project to a friendly error", async () => {
    secretService.create.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, { key: "A", projectIds: [projectId] });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
