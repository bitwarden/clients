import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { ProjectEditCommand } from "./project-edit.command";

describe("ProjectEditCommand", () => {
  const projectService = mock<ProjectService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  let command: ProjectEditCommand;

  const makeProject = (overrides: Partial<ProjectView> = {}) =>
    Object.assign(new ProjectView(), {
      id: projectId,
      organizationId: smOrgId,
      name: "Backend",
      write: true,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ProjectEditCommand(projectService);
  });

  it("renames the project", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject());
    projectService.update.mockResolvedValue(makeProject({ name: "Frontend" }));

    const response = await command.run(
      smOrg,
      projectId.toUpperCase(),
      encodeSmRequest({ name: "Frontend" }),
    );

    expect(response.success).toBe(true);
    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(projectService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ id: projectId, organizationId: smOrgId, name: "Frontend" }),
    );
    expect(response.data).toMatchObject({ object: "sm-project", name: "Frontend" });
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, "abc", { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("treats a project from another organization as not found", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject({ organizationId: smOtherOrgId }));

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
    expect(projectService.update).not.toHaveBeenCalled();
  });

  it("rejects a project the user cannot write", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject({ write: false }));

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(projectService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
